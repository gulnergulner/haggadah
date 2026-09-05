// Run against a local Vite server: node --test scripts/verse-test.mjs
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright-core'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5173'
const CACHE_KEY = 'haggadah.verseCache'
const SUNDAY = new Date('2026-09-06T08:00:00+09:00')
const previous = row('2026-08-30', 'Previous week')
const current = row('2026-09-06', 'Current week')
let browser

function row(id, body, updatedAt = `${id}T00:00:00Z`) {
  return {
    id, reference: 'Reference', reference_en: 'English reference',
    body_ko: body, body_en: `${body} English`,
    published_at: `${id}T00:00:00+09:00`, updated_at: updatedAt,
  }
}

function cacheFor(value, legacy = false) {
  return {
    id: value.id,
    data: {
      id: value.id, reference: value.reference, referenceEn: value.reference_en,
      bodyKo: value.body_ko, bodyEn: value.body_en,
    },
    fetchedAt: SUNDAY.getTime(),
    ...(!legacy && { updatedAt: value.updated_at }),
  }
}

before(async () => {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
})
after(async () => { await browser?.close() })

async function setup(t, { rows = [previous], cache = cacheFor(previous), now = SUNDAY,
  timezoneId = 'Asia/Seoul', offline = false, viewport = { width: 375, height: 667 } } = {}) {
  const context = await browser.newContext({ timezoneId, viewport })
  t.after(() => context.close())
  const page = await context.newPage()
  const state = { rows, offline, requests: [], gate: null, errors: [] }
  page.on('pageerror', (error) => state.errors.push(error.message))
  await context.route('**/api/me', (route) => route.fulfill({ json: { loggedIn: false } }))
  await context.route('https://wjyiovkeduosubtzflqe.supabase.co/**', async (route) => {
    const url = new URL(route.request().url())
    assert.equal(url.pathname, '/rest/v1/haggadot')
    assert.equal(route.request().method(), 'GET')
    assert.equal(url.searchParams.get('limit'), '1')
    const columns = url.searchParams.get('select')
    state.requests.push(columns)
    if (state.gate) await state.gate
    if (state.offline) return route.abort('internetdisconnected')
    const cutoff = url.searchParams.get('id')
    assert.ok(cutoff?.startsWith('lte.'))
    const selected = state.rows.filter((r) => r.id <= cutoff.slice(4))
      .sort((a, b) => b.id.localeCompare(a.id)).slice(0, 1)
    await route.fulfill({ json: selected.map((r) => Object.fromEntries(
      columns.split(',').map((column) => [column, r[column]]),
    )) })
  })
  await page.clock.install({ time: now })
  await page.addInitScript(({ key, value }) => {
    if (!sessionStorage.getItem('verse-test-initialized')) {
      localStorage.clear()
      if (value) localStorage.setItem(key, JSON.stringify(value))
      sessionStorage.setItem('verse-test-initialized', '1')
    }
  }, { key: CACHE_KEY, value: cache && { ...cache, fetchedAt: Math.min(cache.fetchedAt, now.getTime()) } })
  state.open = () => page.goto(BASE)
  state.shown = async (body) => {
    await page.waitForFunction((text) => document.getElementById('verse-body')?.innerText === text, body)
    assert.deepEqual(state.errors, [])
  }
  state.readCache = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), CACHE_KEY)
  state.refresh = () => page.evaluate(async () => {
    const { fetchLatest } = await import('/src/verse.js')
    return fetchLatest()
  })
  state.page = page
  return state
}

test('Sunday before publication keeps previous week and only checks metadata', async (t) => {
  const s = await setup(t)
  await s.open()
  await s.shown(previous.body_ko)
  assert.deepEqual(s.requests, ['id,updated_at'])
  await s.page.reload()
  await s.shown(previous.body_ko)
  assert.deepEqual(s.requests, ['id,updated_at', 'id,updated_at'])
})

test('new publication replaces a fresh cache without flashing old text; reload reuses body', async (t) => {
  const s = await setup(t, { rows: [previous, current] })
  let release
  s.gate = new Promise((resolve) => { release = resolve })
  await s.open()
  assert.equal(await s.page.locator('#verse-body').innerText(), '말씀을 불러오는 중입니다.')
  release()
  s.gate = null
  await s.shown(current.body_ko)
  assert.equal(s.requests.length, 2)
  assert.equal((await s.readCache()).updatedAt, current.updated_at)
  await s.page.reload()
  await s.shown(current.body_ko)
  assert.equal(s.requests.length, 2)
  await s.page.locator('#btn-increase').click()
  assert.equal(await s.page.locator('#counter').innerText(), '1')
  await s.page.locator('#btn-lang').click()
  await s.shown(current.body_en)
})

test('current-week cache skips automatic traffic even after server edits', async (t) => {
  const s = await setup(t, { rows: [current], cache: cacheFor(current) })
  await s.open()
  await s.shown(current.body_ko)
  s.rows = [row(current.id, 'Corrected verse', '2026-09-06T02:00:00Z')]
  await s.page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
  })
  await s.page.clock.runFor(180_000)
  await s.refresh()
  await s.page.reload()
  await s.shown(current.body_ko)
  assert.equal(await s.page.locator('#verse-body').getAttribute('aria-busy'), 'false')
  assert.equal(s.requests.length, 0)
})

test('open screen skips checks beyond thirty minutes until manual refresh', async (t) => {
  const s = await setup(t, { rows: [current], cache: cacheFor(current) })
  await s.open()
  await s.shown(current.body_ko)
  s.rows = [row(current.id, 'Corrected verse', '2026-09-06T02:00:00Z')]
  await s.page.clock.runFor(29 * 60_000)
  assert.equal(s.requests.length, 0)
  await s.page.clock.runFor(31 * 60_000)
  await s.shown(current.body_ko)
  assert.equal(s.requests.length, 0)
  await s.page.locator('#btn-refresh-verse').click()
  await s.shown('Corrected verse')
  assert.equal(s.requests.length, 2)
  await s.page.reload()
  await s.shown('Corrected verse')
  assert.equal(s.requests.length, 2)
})

test('manual check reuses unchanged body and reload does not request again', async (t) => {
  const s = await setup(t, { rows: [current], cache: cacheFor(current) })
  await s.open()
  await s.shown(current.body_ko)
  await s.page.clock.runFor(30 * 60_000)
  await s.page.locator('#btn-refresh-verse').click()
  await s.page.waitForFunction(() => !document.getElementById('btn-refresh-verse').disabled)
  assert.deepEqual(s.requests, ['id,updated_at'])
  await s.page.reload()
  await s.shown(current.body_ko)
  await s.page.clock.runFor(60 * 60_000)
  await s.refresh()
  assert.equal(s.requests.length, 1)
})

test('returning after thirty minutes preserves cache until manual refresh', async (t) => {
  const s = await setup(t, { rows: [current], cache: cacheFor(current) })
  await s.open()
  await s.shown(current.body_ko)
  await s.page.evaluate(() => Object.defineProperty(document, 'visibilityState', {
    configurable: true, value: 'hidden',
  }))
  await s.page.clock.runFor(31 * 60_000)
  assert.equal(s.requests.length, 0)
  s.rows = [row(current.id, 'Corrected on return', '2026-09-06T02:00:00Z')]
  let release
  s.gate = new Promise((resolve) => { release = resolve })
  await s.page.evaluate(() => {
    delete document.visibilityState
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await s.shown(current.body_ko)
  await s.refresh()
  assert.equal(s.requests.length, 0)
  await s.page.locator('#btn-refresh-verse').click()
  release()
  s.gate = null
  await s.shown('Corrected on return')
})

test('manual refresh bypasses cache, disables button, and reuses unchanged body', async (t) => {
  const s = await setup(t, { rows: [current], cache: cacheFor(current) })
  await s.open()
  await s.shown(current.body_ko)
  s.rows = [row(current.id, 'Manually corrected', '2026-09-06T02:00:00Z')]
  const button = s.page.locator('#btn-refresh-verse')
  let release
  s.gate = new Promise((resolve) => { release = resolve })
  await button.click()
  assert.ok(await button.isDisabled())
  assert.equal(await button.getAttribute('aria-busy'), 'true')
  await s.shown(current.body_ko)
  release()
  s.gate = null
  await s.shown('Manually corrected')
  await s.page.waitForFunction(() => !document.getElementById('btn-refresh-verse').disabled)
  assert.equal(s.requests.length, 2)
  await button.click()
  await s.page.waitForFunction(() => !document.getElementById('btn-refresh-verse').disabled)
  assert.equal(s.requests.length, 3)
  assert.equal(s.requests[2], 'id,updated_at')
})

test('manual refresh failure preserves body and allows immediate retry', async (t) => {
  const s = await setup(t, { rows: [current], cache: cacheFor(current) })
  await s.open()
  await s.shown(current.body_ko)
  let release
  s.gate = new Promise((resolve) => { release = resolve })
  await s.page.locator('#btn-refresh-verse').click()
  await s.page.clock.runFor(8001)
  await s.page.waitForFunction(() => !document.getElementById('btn-refresh-verse').disabled)
  assert.match(await s.page.locator('#toast').innerText(), /확인하지 못했습니다/)
  await s.shown(current.body_ko)
  release()
  s.gate = null
  await s.page.locator('#btn-refresh-verse').click()
  await s.page.waitForFunction(() => !document.getElementById('btn-refresh-verse').disabled)
  assert.equal(await s.page.locator('#toast').innerText(), '최신 말씀을 확인했습니다.')
})

test('current-week legacy cache works offline without requesting revision metadata', async (t) => {
  const s = await setup(t, { cache: cacheFor(current, true), offline: true })
  await s.open()
  await s.shown(current.body_ko)
  await s.refresh()
  assert.equal(s.requests.length, 0)
})

test('open screen discovers publication on the next minute check', async (t) => {
  const s = await setup(t)
  await s.open()
  await s.shown(previous.body_ko)
  s.rows.push(current)
  await s.page.clock.runFor(60_000)
  await s.shown(current.body_ko)
  assert.equal(s.requests.length, 3)
  await s.page.clock.runFor(180_000)
  assert.equal(s.requests.length, 3)
})

test('hidden screen pauses periodic checks', async (t) => {
  const s = await setup(t)
  await s.open()
  await s.shown(previous.body_ko)
  await s.page.evaluate(() => Object.defineProperty(document, 'visibilityState', {
    configurable: true, value: 'hidden',
  }))
  await s.page.clock.runFor(120_000)
  assert.equal(s.requests.length, 1)
  s.rows.push(current)
  await s.page.evaluate(() => {
    delete document.visibilityState
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await s.shown(current.body_ko)
})

test('Korea Sunday boundary excludes future week regardless of device timezone', async (t) => {
  const s = await setup(t, {
    rows: [previous, current, row('2026-09-13', 'Future week')],
    now: new Date('2026-09-05T23:59:00+09:00'), timezoneId: 'America/Los_Angeles',
  })
  await s.open()
  await s.shown(previous.body_ko)
  assert.equal(s.requests.length, 0)
  await s.page.clock.runFor(60_000)
  await s.shown(current.body_ko)
  assert.equal(s.requests.length, 2)
})

test('next Sunday resumes checking but keeps last week until publication', async (t) => {
  const s = await setup(t, { now: new Date('2026-09-05T23:59:00+09:00') })
  await s.open()
  await s.shown(previous.body_ko)
  assert.equal(s.requests.length, 0)
  await s.page.clock.runFor(60_000)
  await s.refresh()
  await s.shown(previous.body_ko)
  assert.ok(s.requests.length >= 1)
  assert.ok(s.requests.every((columns) => columns === 'id,updated_at'))
  s.rows.push(current)
  await s.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await s.shown(current.body_ko)
})

test('offline cache survives week change and reconnect discovers current verse', async (t) => {
  const s = await setup(t, { rows: [previous, current], offline: true })
  await s.open()
  await s.shown(previous.body_ko)
  s.offline = false
  await s.page.evaluate(() => window.dispatchEvent(new Event('online')))
  await s.shown(current.body_ko)
})

test('slow connection falls back to cache after eight seconds', async (t) => {
  const s = await setup(t)
  let release
  s.gate = new Promise((resolve) => { release = resolve })
  await s.open()
  await s.page.clock.runFor(8001)
  await s.shown(previous.body_ko)
  release()
})

test('legacy cache without revision is refreshed once', async (t) => {
  const s = await setup(t, { cache: cacheFor(previous, true) })
  await s.open()
  await s.shown(previous.body_ko)
  assert.equal(s.requests.length, 2)
  await s.refresh()
  assert.equal(s.requests.length, 3)
  assert.equal(s.requests[2], 'id,updated_at')
})

test('concurrent refreshes share one metadata request', async (t) => {
  const s = await setup(t)
  await s.open()
  await s.shown(previous.body_ko)
  await s.page.evaluate(async () => {
    const { fetchLatest } = await import('/src/verse.js')
    await Promise.all([fetchLatest(), fetchLatest(), fetchLatest()])
  })
  assert.equal(s.requests.length, 2)
})

test('while awaiting this week, deletion restores older verse; empty server clears cache', async (t) => {
  const older = row('2026-08-23', 'Older week')
  const s = await setup(t, { rows: [older, previous] })
  await s.open()
  await s.shown(previous.body_ko)
  s.rows = [older]
  await s.page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
  await s.shown(older.body_ko)
  s.rows = []
  await s.page.evaluate(() => window.dispatchEvent(new Event('online')))
  await s.shown('아직 게시된 말씀이 없습니다.')
  assert.equal(await s.readCache(), null)
})

test('initial visit downloads one body and fits desktop layout', async (t) => {
  const s = await setup(t, { rows: [current], cache: null, viewport: { width: 1440, height: 900 } })
  await s.open()
  await s.shown(current.body_ko)
  assert.equal(s.requests.length, 2)
  assert.ok(await s.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
})
