// Run against a local Vite server: node --test scripts/speech-test.mjs
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright-core'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5173'
let browser
before(async () => { browser = await chromium.launch({ channel: 'msedge', headless: true }) })
after(async () => { await browser?.close() })

async function setup(t, { supported = true, english = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 320, height: 667 }, timezoneId: 'Asia/Seoul' })
  t.after(() => context.close())
  const page = await context.newPage()
  await page.clock.install({ time: new Date('2026-09-06T08:00:00+09:00') })
  await page.route('**/api/me', (route) => route.fulfill({ json: { loggedIn: false } }))
  await page.route('**/rest/v1/haggadot**', (route) => route.fulfill({ json: [{
    id: '2026-08-30', reference: '이전 말씀', reference_en: 'Previous reference',
    body_ko: '이전 본문', body_en: 'Previous English verse',
  }] }))
  await page.addInitScript(({ supported, english }) => {
    if (!sessionStorage.getItem('speech-test-initialized')) {
      localStorage.clear()
      localStorage.setItem('haggadah.v1', JSON.stringify({ counts: {}, lang: 'en' }))
      localStorage.setItem('haggadah.verseCache', JSON.stringify({
        id: '2026-09-06', data: {
          id: '2026-09-06', reference: '말씀', referenceEn: 'Deuteronomy 16:3',
          bodyKo: '한국어 말씀', bodyEn: english ? 'Remember this day.' : '',
        }, fetchedAt: Date.now(),
      }))
      sessionStorage.setItem('speech-test-initialized', '1')
    }
    window.speechTest = { utterances: [], canceled: 0, paused: 0, resumed: 0 }
    if (supported) {
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
        getVoices: () => [
          { lang: 'ko-KR' },
          { lang: 'en-US', name: 'Online English', localService: false },
          { lang: 'en-GB', name: 'Device English', localService: true },
        ],
        speak: (utterance) => window.speechTest.utterances.push(utterance),
        cancel: () => { window.speechTest.canceled++ },
        pause: () => { window.speechTest.paused++ },
        resume: () => { window.speechTest.resumed++ },
      } })
    } else {
      delete window.speechSynthesis
      delete window.SpeechSynthesisUtterance
    }
  }, { supported, english })
  await page.goto(BASE)
  return page
}

test('plays, pauses, resumes and stops the English verse without starting a new utterance', async (t) => {
  const page = await setup(t)
  const button = page.locator('#btn-verse-audio')
  assert.ok(await button.isVisible())
  await button.click()
  assert.equal(await button.innerText(), 'Pause')
  assert.equal(await button.getAttribute('aria-label'), 'Pause reading the verse')
  const spoken = await page.evaluate(() => {
    const { text, lang, voice } = window.speechTest.utterances[0]
    return { text, lang, voice: voice?.lang }
  })
  assert.deepEqual(spoken, { text: 'Deuteronomy 16:3. Remember this day.', lang: 'en-US', voice: 'en-GB' })
  await button.click()
  assert.equal(await button.innerText(), 'Resume')
  assert.equal(await page.evaluate(() => window.speechTest.paused), 1)
  await button.click()
  assert.equal(await button.innerText(), 'Pause')
  assert.equal(await page.evaluate(() => window.speechTest.resumed), 1)
  assert.equal(await page.evaluate(() => window.speechTest.utterances.length), 1)
  await page.locator('#btn-verse-audio-stop').click()
  assert.equal(await page.evaluate(() => window.speechTest.canceled), 1)
  await button.click()
  await page.evaluate(() => window.speechTest.utterances[0].onend())
  assert.equal(await button.innerText(), 'Pause', 'an old end event does not stop new playback')
  await page.evaluate(() => window.speechTest.utterances[1].onend())
  assert.equal(await button.innerText(), 'Listen')
})

test('changing language or verse stops playback without changing the count', async (t) => {
  const page = await setup(t)
  const button = page.locator('#btn-verse-audio')
  await button.click()
  await page.locator('#btn-lang').click()
  assert.ok(await button.isHidden())
  assert.equal(await page.evaluate(() => window.speechTest.canceled), 1)
  await page.locator('#btn-lang').click()
  await button.click()
  await page.locator('#btn-prev-verse').click()
  await page.waitForFunction(() => document.querySelector('#verse-body').innerText === 'Previous English verse')
  assert.equal(await page.evaluate(() => window.speechTest.canceled), 2)
  assert.equal(await button.innerText(), 'Listen')
  assert.equal(await page.locator('#counter').innerText(), '0')
  await button.click()
  assert.match(await page.evaluate(() => window.speechTest.utterances.at(-1).text), /Previous English verse/)
})

test('playback errors allow retry and leaving the page stops speech', async (t) => {
  const page = await setup(t)
  const button = page.locator('#btn-verse-audio')
  await button.click()
  await page.evaluate(() => window.speechTest.utterances[0].onerror({ error: 'audio-busy' }))
  assert.equal(await button.innerText(), 'Listen')
  assert.match(await page.locator('#toast').innerText(), /Unable to play audio/)
  await button.click()
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
  assert.equal(await page.evaluate(() => window.speechTest.canceled), 1)
  assert.equal(await button.innerText(), 'Listen')
})

test('unavailable speech or missing English content leaves an explanatory disabled button', async (t) => {
  const unsupported = await setup(t, { supported: false })
  assert.ok(await unsupported.locator('#btn-verse-audio').isDisabled())
  assert.ok(await unsupported.locator('#verse-audio-rate').isDisabled())
  assert.match(await unsupported.locator('#btn-verse-audio').getAttribute('title'), /not supported/)
  const missing = await setup(t, { english: false })
  assert.ok(await missing.locator('#btn-verse-audio').isDisabled())
  assert.ok(await missing.locator('#verse-audio-rate').isDisabled())
  assert.match(await missing.locator('#btn-verse-audio').getAttribute('title'), /No English verse/)
})

test('speed changes restart playback and persist across reloads', async (t) => {
  const page = await setup(t)
  const button = page.locator('#btn-verse-audio')
  const speed = page.locator('#verse-audio-rate')
  assert.equal(await speed.inputValue(), '1')
  await speed.selectOption('0.7')
  await button.click()
  assert.equal(await page.evaluate(() => window.speechTest.utterances[0].rate), 0.7)
  await speed.selectOption('0.85')
  assert.equal(await page.evaluate(() => window.speechTest.canceled), 1)
  assert.equal(await page.evaluate(() => window.speechTest.utterances[1].rate), 0.85)
  assert.equal(await button.innerText(), 'Pause')
  await page.evaluate(() => window.speechTest.utterances[0].onend())
  assert.equal(await button.innerText(), 'Pause')
  await page.locator('#btn-verse-audio-stop').click()
  await page.reload()
  assert.equal(await speed.inputValue(), '0.85')
  await button.click()
  assert.equal(await page.evaluate(() => window.speechTest.utterances[0].rate), 0.85)
})

test('stopping while paused resets the engine and permits playback again', async (t) => {
  const page = await setup(t)
  const button = page.locator('#btn-verse-audio')
  await button.click()
  await button.click()
  assert.equal(await button.innerText(), 'Resume')
  await page.locator('#btn-verse-audio-stop').click()
  assert.equal(await page.evaluate(() => window.speechTest.resumed), 1)
  assert.equal(await button.innerText(), 'Listen')
  await button.click()
  assert.equal(await page.evaluate(() => window.speechTest.utterances.length), 2)
})

test('changing speed while paused restarts playback without leaving the engine paused', async (t) => {
  const page = await setup(t)
  const button = page.locator('#btn-verse-audio')
  await button.click()
  await button.click()
  await page.locator('#verse-audio-rate').selectOption('0.7')
  assert.equal(await page.evaluate(() => window.speechTest.canceled), 1)
  assert.equal(await page.evaluate(() => window.speechTest.resumed), 1)
  assert.equal(await page.evaluate(() => window.speechTest.utterances[1].rate), 0.7)
  assert.equal(await button.innerText(), 'Pause')
})
