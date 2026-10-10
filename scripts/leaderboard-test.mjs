import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright-core'
import { createLeaderboardHandler } from '../api/leaderboard.js'
import { createSessionToken } from '../api/_lib/auth.js'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5173'
let browser
before(async () => { browser = await chromium.launch({ channel: 'msedge', headless: true }) })
after(async () => { await browser?.close() })

function response() {
  return {
    headers: {}, code: 200, data: null,
    setHeader(key, value) { this.headers[key] = value },
    status(code) { this.code = code; return this },
    json(data) { this.data = data; return this },
  }
}

test('API accepts guests and signed sessions, rejects writes, and hides database errors', async () => {
  const originalSecret = process.env.SESSION_SECRET
  process.env.SESSION_SECRET = 'leaderboard-test-secret-123456'
  try {
    const seen = []
    const handler = createLeaderboardHandler({ read: async (uid) => {
      seen.push(uid)
      return { entries: [], participants: 0, myEntry: null }
    } })
    const guest = response()
    await handler({ method: 'GET', headers: {} }, guest)
    assert.equal(guest.code, 200)
    assert.equal(guest.headers['Cache-Control'], 'no-store')
    const member = response()
    await handler({ method: 'GET', headers: {
      cookie: `hp_session=${createSessionToken('12345')}`,
    } }, member)
    assert.deepEqual(seen, [null, '12345'])
    const write = response()
    await handler({ method: 'POST', headers: {} }, write)
    assert.equal(write.code, 405)
    assert.equal(seen.length, 2)
    const unavailable = createLeaderboardHandler({ read: async () => {
      throw new Error('private database connection detail')
    } })
    const failure = response()
    await unavailable({ method: 'GET', headers: {} }, failure)
    assert.equal(failure.code, 503)
    assert.doesNotMatch(JSON.stringify(failure.data), /private database/)
  } finally {
    if (originalSecret === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = originalSecret
  }
})

async function setup(t, { loggedIn = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } })
  t.after(() => context.close())
  const page = await context.newPage()
  const s = { page, errors: [], code: 200, writes: 0, requests: 0, gate: null,
    data: { entries: [
      { rank: 1, nickname: '<img src=x onerror=alert(1)>', total: 1000, isMe: false },
      { rank: 1, nickname: '말씀새싹', total: 1000, isMe: loggedIn },
      { rank: 3, nickname: '성도', total: 900, isMe: false },
    ], participants: 80, myEntry: loggedIn
      ? { rank: 1, nickname: '말씀새싹', total: 1000, isMe: true } : null },
  }
  page.on('pageerror', (error) => s.errors.push(error.message))
  await page.route('**/api/me', (route) => route.fulfill({ json: {
    loggedIn, nickname: '말씀새싹', haggadah: { total: 1000, counts: {} },
  } }))
  await page.route('**/api/haggadah-state', (route) => {
    s.writes++
    return route.fulfill({ json: { ok: true } })
  })
  await page.route('**/api/leaderboard', async (route) => {
    s.requests++
    if (s.gate) await s.gate
    await route.fulfill({ status: s.code, json: s.data })
  })
  await page.addInitScript(() => {
    const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
    d.setUTCDate(d.getUTCDate() - d.getUTCDay())
    localStorage.setItem('haggadah.verseCache', JSON.stringify({ data: {
      id: d.toISOString().slice(0, 10), reference: '시편', bodyKo: '말씀을 읊조려요',
    } }))
    localStorage.setItem('haggadah.kakaoNudge', '1')
  })
  await page.goto(BASE)
  await page.waitForFunction(() => document.getElementById('verse-body').innerText === '말씀을 읊조려요')
  await page.locator('#btn-stats').click()
  s.open = () => page.locator('#btn-leaderboard').click()
  s.ready = () => page.waitForFunction(() => !document.getElementById('btn-leaderboard-refresh').disabled)
  return s
}

test('guest ranking and mobile layout', async (t) => {
  const s = await setup(t)
  assert.equal(s.requests, 0)
  await s.open()
  await s.ready()
  assert.deepEqual(await s.page.locator('.leaderboard-rank').allTextContents(), ['1위', '1위', '3위'])
  assert.equal(await s.page.locator('#leaderboard-list img').count(), 0)
  assert.match(await s.page.locator('.leaderboard-name').first().innerText(), /<img/)
  assert.ok(await s.page.locator('#btn-leaderboard-login').isVisible())
  assert.ok(await s.page.locator('#leaderboard-mine').isHidden())
  for (const width of [320, 375, 768]) {
    await s.page.setViewportSize({ width, height: 667 })
    assert.ok(await s.page.locator('.leaderboard-card').evaluate((el) => el.scrollWidth <= el.clientWidth))
  }
  await s.page.setViewportSize({ width: 375, height: 667 })
  await s.page.screenshot({ path: '/tmp/haggadah-leaderboard.png' })
  await s.page.keyboard.press('Escape')
  assert.ok(await s.page.locator('#leaderboard-overlay').isHidden())
  assert.ok(await s.page.locator('#btn-leaderboard').evaluate((el) => el === document.activeElement))
  assert.deepEqual(s.errors, [])
})

test('member sees own rank outside top 50 and flushes saved counts before reading', async (t) => {
  const s = await setup(t, { loggedIn: true })
  s.data.myEntry = { rank: 65, nickname: '말씀새싹', total: 120, isMe: true }
  s.data.entries[1].isMe = false
  const writes = s.writes
  await s.open()
  await s.ready()
  assert.match(await s.page.locator('#leaderboard-mine').innerText(), /65위.*120회/)
  assert.ok(s.writes > writes)
  assert.ok(await s.page.locator('#btn-leaderboard-login').isHidden())
  assert.deepEqual(s.errors, [])
})

test('failed query retries successfully, empty ranking is clear, reopening ignores stale response', async (t) => {
  const s = await setup(t)
  s.code = 503
  await s.open()
  await s.ready()
  assert.match(await s.page.locator('#leaderboard-status').innerText(), /불러오지 못했습니다/)
  s.code = 200
  s.data = { entries: [], myEntry: null, participants: 0 }
  await s.page.locator('#btn-leaderboard-refresh').click()
  await s.ready()
  assert.match(await s.page.locator('#leaderboard-status').innerText(), /아직 등록된 기록/)
  let release
  s.gate = new Promise((resolve) => { release = resolve })
  await s.page.locator('#btn-leaderboard-refresh').click()
  assert.ok(await s.page.locator('#btn-leaderboard-refresh').isDisabled())
  await s.page.locator('#btn-leaderboard-close').click()
  release()
  s.gate = null
  await s.open()
  await s.ready()
  assert.deepEqual(s.errors, [])
})
