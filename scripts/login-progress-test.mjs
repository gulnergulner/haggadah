import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { chromium } from 'playwright-core'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5173'
let browser
before(async () => { browser = await chromium.launch({ channel: 'msedge', headless: true }) })
after(async () => { await browser?.close() })

async function setup(t, { returning = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } })
  const page = await context.newPage()
  const state = { requests: 0, errors: [] }
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/auth/kakao') state.requests++
  })
  page.on('pageerror', (error) => state.errors.push(error.message))
  let release
  const gate = new Promise((resolve) => { release = resolve })
  state.release = release
  t.after(async () => { release(); await context.close() })
  await context.route('**/api/me', async (route) => {
    if (returning) await gate
    return route.fulfill({ json: { loggedIn: returning, nickname: '성도', haggadah: {} } })
  })
  await context.route('**/api/haggadah-state', (route) => route.fulfill({ json: { ok: true } }))
  await context.route('**/api/leaderboard', (route) => route.fulfill({ json: {
    entries: [], participants: 0, myEntry: null,
  } }))
  await context.route('**/api/auth/kakao', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150))
    await route.fulfill({ contentType: 'text/html', body: '<p>Kakao login page</p>' })
  })
  await page.addInitScript(() => {
    const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
    d.setUTCDate(d.getUTCDate() - d.getUTCDay())
    localStorage.setItem('haggadah.verseCache', JSON.stringify({ data: {
      id: d.toISOString().slice(0, 10), reference: '시편', bodyKo: '말씀을 읊조려요',
    } }))
    localStorage.setItem('haggadah.kakaoNudge', '1')
  })
  await page.goto(BASE + (returning ? '/?login=ok' : '/'))
  state.page = page
  return state
}

for (const id of ['btn-stats-kakao', 'btn-done-sync', 'btn-leaderboard-login']) {
  test(`${id} shows progress during slow navigation and prevents duplicate login`, async (t) => {
    const s = await setup(t)
    const { page } = s
    if (id === 'btn-done-sync') {
      await page.evaluate(() => { document.getElementById('done-overlay').hidden = false })
    } else {
      await page.locator('#btn-stats').click()
      if (id === 'btn-leaderboard-login') {
        await page.locator('#btn-leaderboard').click()
        await page.waitForFunction(() => !document.getElementById('btn-leaderboard-refresh').disabled)
      }
    }
    const navigation = page.waitForRequest('**/api/auth/kakao')
    const progress = await page.evaluate((id) => {
      document.getElementById(id).click()
      return {
      visible: !document.getElementById('login-progress').hidden,
      message: document.getElementById('login-progress-message').textContent,
      disabled: document.getElementById(id).disabled,
      busy: document.getElementById(id).getAttribute('aria-busy'),
    }
    }, id)
    assert.ok(progress.visible)
    assert.equal(progress.message, '카카오 로그인 진행 중…')
    assert.ok(progress.disabled)
    assert.equal(progress.busy, 'true')
    await page.evaluate((id) => {
      const button = document.getElementById(id)
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }, id)
    await navigation
    assert.equal(s.requests, 1)
    await page.waitForURL('**/api/auth/kakao')
    await page.goBack()
    assert.ok(await page.evaluate(() => document.getElementById('login-progress').hidden))
    assert.ok(await page.evaluate((id) => !document.getElementById(id).disabled, id))
    assert.deepEqual(s.errors, [])
  })
}

test('return from Kakao shows confirmation until session response and then clears progress', async (t) => {
  const s = await setup(t, { returning: true })
  assert.equal(await s.page.locator('#login-progress-message').innerText(), '카카오 로그인 확인 중…')
  assert.ok(await s.page.locator('#login-progress').isVisible())
  s.release()
  await s.page.waitForFunction(() => document.getElementById('login-progress').hidden)
  assert.match(await s.page.locator('#toast').innerText(), /카카오 연결됨/)
  assert.deepEqual(s.errors, [])
})
