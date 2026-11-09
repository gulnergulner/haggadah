// Run against a local Vite server: node --test scripts/pinch-test.mjs
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright-core'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5173'
let browser
before(async () => { browser = await chromium.launch({ channel: 'msedge', headless: true }) })
after(async () => { await browser?.close() })

async function setup(t, lang = 'en') {
  const context = await browser.newContext({ viewport: { width: 375, height: 667 },
    timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  t.after(() => context.close())
  const page = await context.newPage()
  await page.clock.install({ time: new Date('2026-09-06T08:00:00+09:00') })
  await page.route('**/api/me', (route) => route.fulfill({ json: { loggedIn: false } }))
  await page.addInitScript((lang) => {
    if (!sessionStorage.getItem('pinch-test-initialized')) {
      localStorage.clear()
      localStorage.setItem('haggadah.v1', JSON.stringify({ counts: {}, lang }))
      localStorage.setItem('haggadah.verseCache', JSON.stringify({ data: {
        id: '2026-09-06', reference: '신명기 16:3', referenceEn: 'Deuteronomy 16:3',
        bodyKo: '이는 네 평생에 항상 네가 애굽 땅에서 나온 날을 기억하게 할 것이니라.',
        bodyEn: 'Do not eat it with bread made with yeast, but for seven days eat unleavened bread, the bread of affliction, because you left Egypt in haste, so that all the days of your life you may remember the time of your departure from Egypt.',
      } }))
      sessionStorage.setItem('pinch-test-initialized', '1')
    }
    window.speechTest = { utterances: [], canceled: 0 }
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [], speak: (utterance) => window.speechTest.utterances.push(utterance),
      cancel: () => { window.speechTest.canceled++ }, pause: () => {}, resume: () => {},
    } })
  }, lang)
  await page.goto(BASE)
  await page.evaluate(() => document.fonts.ready)
  return page
}

async function pinch(page, { scale, selector = '#verse-body', secondSelector = selector, resizeDuring = false } = {}) {
  return page.evaluate(({ scale, selector, secondSelector, resizeDuring }) => {
    const target = document.querySelector(selector)
    const otherTarget = document.querySelector(secondSelector)
    const touch = (id, x, element) => new Touch({ identifier: id, target: element,
      clientX: x, clientY: 200, pageX: x, pageY: 200, screenX: x, screenY: 200 })
    const one = touch(1, 120, target)
    const two = touch(2, 220, otherTarget)
    const first = new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [one], targetTouches: [one], changedTouches: [one] })
    target.dispatchEvent(first)
    const second = new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [one, two], targetTouches: [one, two], changedTouches: [two] })
    target.dispatchEvent(second)
    const moved = touch(2, 120 + 100 * scale, otherTarget)
    const move = new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [one, moved], targetTouches: [one, moved], changedTouches: [moved] })
    target.dispatchEvent(move)
    if (resizeDuring) window.dispatchEvent(new Event('resize'))
    const end = new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [one], targetTouches: [one], changedTouches: [moved] })
    target.dispatchEvent(end)
    return { firstPrevented: first.defaultPrevented, startPrevented: second.defaultPrevented, movePrevented: move.defaultPrevented }
  }, { scale, selector, secondSelector, resizeDuring })
}

const size = (page, selector = '#verse-body') => page.locator(selector).evaluate((el) => parseFloat(getComputedStyle(el).fontSize))

for (const lang of ['ko', 'en']) {
  test(`${lang}: two fingers resize the verse and preserve the size on return`, async (t) => {
    const page = await setup(t, lang)
    const before = await size(page)
    const audioFont = lang === 'en' ? await size(page, '#btn-verse-audio') : null
    const result = await pinch(page, { scale: 2, secondSelector: '#verse-ref', resizeDuring: true })
    assert.deepEqual(result, { firstPrevented: false, startPrevented: true, movePrevented: true })
    const enlarged = await size(page)
    assert.equal(enlarged, Math.min(80, before * 2))
    assert.equal(await size(page, '#verse-ref'), enlarged)
    assert.ok(await page.evaluate(() => document.querySelector('.verse-card').scrollHeight > document.querySelector('.verse-main').clientHeight))
    assert.equal(await page.evaluate(() => visualViewport.scale), 1)
    if (lang === 'en') {
      assert.equal(await size(page, '#btn-verse-audio'), audioFont)
      await page.evaluate(() => {
        const main = document.querySelector('.verse-main')
        main.scrollTop = main.scrollHeight
      })
      const visible = await page.evaluate(() => {
        const main = document.querySelector('.verse-main').getBoundingClientRect()
        const control = document.querySelector('#btn-verse-audio').getBoundingClientRect()
        return control.top >= main.top && control.bottom <= main.bottom
      })
      assert.equal(visible, true, 'audio controls remain reachable after enlargement')
    }
    await page.reload()
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await size(page), enlarged)
    await pinch(page, { scale: 0.5 })
    assert.equal(await size(page), Math.max(12, Math.round(enlarged * 0.5)))
    await page.locator('#font-increase').click()
    assert.equal(await size(page), Math.min(80, Math.max(12, Math.round(enlarged * 0.5)) + 4))
    await page.locator('#font-decrease').click()
    assert.equal(await size(page), Math.max(12, Math.round(enlarged * 0.5)))
  })
}

test('real browser touch events resize the English verse', async (t) => {
  const page = await setup(t)
  const session = await page.context().newCDPSession(page)
  const box = await page.locator('#verse-body').boundingBox()
  const y = Math.round(box.y + Math.min(box.height / 2, 80))
  const first = { x: 125, y, id: 1 }
  const second = { x: 205, y, id: 2 }
  const moved = { x: 260, y, id: 2 }
  const before = await size(page)
  await page.evaluate(() => {
    document.querySelector('.verse-main').addEventListener('touchstart', (event) => {
      if (event.isTrusted && event.touches.length === 2) window.trustedPinch = true
    }, { capture: true })
  })
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [first, moved] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [first] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  assert.equal(await page.evaluate(() => window.trustedPinch), true)
  assert.ok(await size(page) > before)
})

test('touching audio controls never starts a pinch and the controls remain usable', async (t) => {
  const page = await setup(t)
  const before = await size(page)
  const result = await pinch(page, { scale: 2, selector: '#btn-verse-audio', secondSelector: '#verse-audio-rate' })
  assert.deepEqual(result, { firstPrevented: false, startPrevented: false, movePrevented: false })
  assert.equal(await size(page), before)
  await page.locator('#btn-verse-audio').click()
  assert.equal(await page.locator('#btn-verse-audio').innerText(), 'Pause')
  await page.locator('#verse-audio-rate').selectOption('0.7')
  assert.equal(await page.locator('#verse-audio-rate').inputValue(), '0.7')
})

test('pinching during playback keeps speech active and repositions the highlight', async (t) => {
  const page = await setup(t)
  await page.locator('#btn-verse-audio').click()
  await page.evaluate(() => {
    const utterance = window.speechTest.utterances[0]
    utterance.onboundary({ name: 'word', charIndex: utterance.text.indexOf('Do not'), charLength: 2 })
  })
  assert.ok(await page.locator('.verse-spoken-overlay').count())
  await pinch(page, { scale: 1.3 })
  assert.equal(await page.locator('#btn-verse-audio').innerText(), 'Pause')
  assert.equal(await page.evaluate(() => window.speechTest.canceled), 0)
  const geometry = await page.evaluate(() => {
    const text = document.querySelector('#verse-body').firstChild
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 2)
    const rect = range.getBoundingClientRect()
    const mark = document.querySelector('.verse-spoken-overlay')?.getBoundingClientRect()
    return mark && { word: [rect.x, rect.y, rect.width, rect.height], mark: [mark.x, mark.y, mark.width, mark.height] }
  })
  assert.ok(geometry)
  assert.deepEqual(geometry.mark, geometry.word)
})
