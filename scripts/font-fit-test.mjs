// Run against a local Vite server: node --test scripts/font-fit-test.mjs
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright-core'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5173'
const VERSE = { id: '2026-09-06', reference: '신명기 16:3', referenceEn: 'Deuteronomy 16:3',
  bodyKo: '이는 네 평생에 항상 네가 애굽 땅에서 나온 날을 기억하게 할 것이니라.',
  bodyEn: 'Remember all the days of your life the time of your departure from Egypt.' }
let browser
before(async () => { browser = await chromium.launch({ channel: 'msedge', headless: true }) })
after(async () => { await browser?.close() })

async function setup(t, { lang = 'ko', viewport = { width: 375, height: 812 }, saved = null, uncached = false } = {}) {
  const context = await browser.newContext({ viewport, timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  t.after(() => context.close())
  const page = await context.newPage()
  await page.clock.install({ time: new Date('2026-09-06T08:00:00+09:00') })
  await page.route('**/api/me', (route) => route.fulfill({ json: { loggedIn: false } }))
  if (uncached) await page.route('**/rest/v1/haggadot**', (route) => route.fulfill({ json: [{
    id: VERSE.id, reference: VERSE.reference, reference_en: VERSE.referenceEn,
    body_ko: VERSE.bodyKo, body_en: VERSE.bodyEn, updated_at: '2026-09-06T00:00:00Z',
  }] }))
  await page.addInitScript(({ lang, saved, uncached, verse }) => {
    if (sessionStorage.getItem('font-fit-test-initialized')) return
    localStorage.clear()
    localStorage.setItem('haggadah.v1', JSON.stringify({ lang, counts: {} }))
    if (!uncached) localStorage.setItem('haggadah.verseCache', JSON.stringify({ data: verse }))
    if (saved) {
      const reference = lang === 'ko' ? verse.reference : verse.referenceEn
      const body = lang === 'ko' ? verse.bodyKo : verse.bodyEn
      localStorage.setItem('haggadah.verseFontFit.v1', JSON.stringify({
        key: JSON.stringify([verse.id, lang, `📖 ${reference}`, body, 0]), size: 12, ...saved,
      }))
    }
    sessionStorage.setItem('font-fit-test-initialized', '1')
  }, { lang, saved, uncached, verse: VERSE })
  await page.goto(BASE)
  await page.waitForFunction((text) => document.querySelector('#verse-body').textContent === text,
    lang === 'ko' ? VERSE.bodyKo : VERSE.bodyEn)
  await page.evaluate(() => document.fonts.ready)
  await page.clock.runFor(100)
  return page
}

const size = (page) => page.locator('#verse-body').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))

for (const lang of ['ko', 'en']) {
  test(`${lang}: the first network load fits the verse to the screen`, async (t) => {
    const page = await setup(t, { lang, uncached: true })
    assert.ok(await size(page) > 20, 'the loading placeholder size does not remain after the verse arrives')
  })
  for (const saved of [{}, { manual: false }]) {
    test(`${lang}: stale automatic ${'manual' in saved ? 'current' : 'legacy'} fit is recalculated on load`, async (t) => {
      const page = await setup(t, { lang, saved })
      const actual = await size(page)
      assert.ok(actual > 12, `expected screen-fitting text, got ${actual}px`)
      const fit = await page.evaluate(() => {
        const main = document.querySelector('.verse-main')
        const card = document.querySelector('.verse-card')
        const style = getComputedStyle(main)
        const avail = main.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
        const current = parseFloat(getComputedStyle(card).fontSize)
        const height = card.scrollHeight
        card.style.fontSize = `${current + 1}px`
        const nextHeight = card.scrollHeight
        card.style.fontSize = `${current}px`
        return { avail, current, height, nextHeight }
      })
      assert.ok(fit.height <= fit.avail, 'verse and playback controls fit within available height')
      assert.ok(fit.current === 44 || fit.nextHeight > fit.avail, 'uses the largest available automatic size')
      if (lang === 'en') assert.ok(await page.locator('#verse-audio').isVisible())
    })
  }
}

test('automatic fit grows again when the available screen becomes taller', async (t) => {
  const page = await setup(t, { viewport: { width: 375, height: 400 } })
  const small = await size(page)
  await page.setViewportSize({ width: 375, height: 900 })
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  const large = await size(page)
  assert.ok(large > small, `${small}px should grow for a taller screen, got ${large}px`)
  await page.reload()
  await page.evaluate(() => document.fonts.ready)
  assert.equal(await size(page), large)
})

test('automatic fit responds when the available area changes without a window resize', async (t) => {
  const page = await setup(t)
  const initial = await size(page)
  await page.evaluate(() => { document.querySelector('.dock').style.paddingBottom = '300px' })
  await page.clock.runFor(100)
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const smaller = await size(page)
  assert.ok(smaller < initial, `${initial}px should shrink when the dock grows, got ${smaller}px`)
  await page.evaluate(() => { document.querySelector('.dock').style.paddingBottom = '' })
  await page.clock.runFor(100)
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  assert.equal(await size(page), initial, 'text grows back to fit when the available space returns')
})

test('button-adjusted size remains deliberate across reload and a taller screen', async (t) => {
  const page = await setup(t, { lang: 'en' })
  await page.locator('#font-decrease').click()
  const chosen = await size(page)
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('haggadah.verseFontFit.v1')).manual), true)
  await page.setViewportSize({ width: 375, height: 400 })
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  assert.ok(await size(page) < chosen, 'text shrinks when necessary to fit a smaller screen')
  await page.setViewportSize({ width: 375, height: 950 })
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  assert.equal(await size(page), chosen, 'the chosen size returns when there is room')
  await page.reload()
  await page.evaluate(() => document.fonts.ready)
  assert.equal(await size(page), chosen)
})
