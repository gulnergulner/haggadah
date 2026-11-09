// Run against a local Vite server: node --test scripts/speech-test.mjs
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright-core'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5173'
let browser
before(async () => { browser = await chromium.launch({ channel: 'msedge', headless: true }) })
after(async () => { await browser?.close() })

async function setup(t, { supported = true, english = true, longEnglish = false, multiline = false, legacyFit = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 320, height: 667 }, timezoneId: 'Asia/Seoul' })
  t.after(() => context.close())
  const page = await context.newPage()
  await page.clock.install({ time: new Date('2026-09-06T08:00:00+09:00') })
  await page.route('**/api/me', (route) => route.fulfill({ json: { loggedIn: false } }))
  await page.route('**/rest/v1/haggadot**', (route) => route.fulfill({ json: [{
    id: '2026-08-30', reference: '이전 말씀', reference_en: 'Previous reference',
    body_ko: '이전 본문', body_en: 'Previous English verse',
  }] }))
  await page.addInitScript(({ supported, english, longEnglish, multiline, legacyFit }) => {
    if (!sessionStorage.getItem('speech-test-initialized')) {
      localStorage.clear()
      localStorage.setItem('haggadah.v1', JSON.stringify({ counts: {}, lang: 'en' }))
      localStorage.setItem('haggadah.verseCache', JSON.stringify({
        id: '2026-09-06', data: {
          id: '2026-09-06', reference: '말씀', referenceEn: 'Deuteronomy 16:3',
          bodyKo: '한국어 말씀', bodyEn: !english ? '' : longEnglish
            ? 'Do not eat it with bread made with yeast, but for seven days eat unleavened bread, the bread of affliction, because you left Egypt in haste, so that all the days of your life you may remember the time of your departure from Egypt.'
            : multiline ? 'Remember this day.\nAlways keep it.' : 'Remember this day.',
        }, fetchedAt: Date.now(),
      }))
      if (legacyFit) localStorage.setItem('haggadah.verseFontFit.v1', JSON.stringify({
        key: JSON.stringify(['2026-09-06', 'en', '📖 Deuteronomy 16:3', 'Remember this day.Always keep it.', 0]),
        size: 14,
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
  }, { supported, english, longEnglish, multiline, legacyFit })
  await page.goto(BASE)
  return page
}

test('plays, pauses and resumes the English verse without starting a new utterance', async (t) => {
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
  assert.equal(await page.locator('#btn-verse-audio-stop').count(), 0)
  await page.evaluate(() => window.speechTest.utterances[0].onend())
  assert.equal(await button.innerText(), 'Listen')
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
  await page.reload()
  assert.equal(await speed.inputValue(), '0.85')
  await button.click()
  assert.equal(await page.evaluate(() => window.speechTest.utterances[0].rate), 0.85)
})

test('leaving while paused resets the engine and permits playback again', async (t) => {
  const page = await setup(t)
  const button = page.locator('#btn-verse-audio')
  await button.click()
  await button.click()
  assert.equal(await button.innerText(), 'Resume')
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
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

test('audio controls appear below the verse with play and pause at the right', async (t) => {
  const page = await setup(t, { longEnglish: true })
  const button = page.locator('#btn-verse-audio')
  for (const state of ['idle', 'playing', 'paused']) {
    if (state !== 'idle') await button.click()
    const layout = await page.evaluate(() => {
      const box = (selector) => {
        const r = document.querySelector(selector).getBoundingClientRect()
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
      }
      return { body: box('#verse-body'), audio: box('#verse-audio'),
        speed: box('.verse-audio-speed'), button: box('#btn-verse-audio'),
        width: document.documentElement.scrollWidth }
    })
    assert.ok(layout.body.bottom <= layout.audio.top, `${state}: controls are below text`)
    assert.ok(layout.speed.right <= layout.button.left, `${state}: play button is to the right`)
    assert.ok(layout.button.right <= 320 && layout.width <= 320, `${state}: controls fit screen`)
  }
})

test('highlights the spoken reference and words, preserves line breaks, and clears on completion', async (t) => {
  const page = await setup(t, { multiline: true })
  const button = page.locator('#btn-verse-audio')
  const highlight = page.locator('.verse-spoken-word')
  await button.click()
  await page.evaluate(() => window.speechTest.utterances[0].onboundary({ name: 'word', charIndex: 0, charLength: 11 }))
  assert.equal(await page.locator('#verse-ref .verse-spoken-word').innerText(), 'Deuteronomy')
  await page.evaluate(() => {
    const utterance = window.speechTest.utterances[0]
    utterance.onboundary({ name: 'word', charIndex: utterance.text.indexOf('Remember'), charLength: 8 })
  })
  assert.equal(await page.locator('#verse-body .verse-spoken-word').innerText(), 'Remember')
  assert.equal(await page.locator('#verse-body').textContent(), 'Remember this day.\nAlways keep it.')
  await button.click()
  assert.equal(await highlight.innerText(), 'Remember', 'pause keeps the current highlight')
  await button.click()
  await page.evaluate(() => {
    const utterance = window.speechTest.utterances[0]
    utterance.onboundary({ name: 'word', charIndex: utterance.text.indexOf('Always'), charLength: 0 })
  })
  assert.equal(await highlight.innerText(), 'Always', 'word boundaries without length are supported')
  assert.equal(await page.locator('#verse-body').innerText(), 'Remember this day.\nAlways keep it.')
  await page.evaluate(() => window.speechTest.utterances[0].onend())
  assert.equal(await highlight.count(), 0)
  assert.equal(await page.locator('#verse-body').textContent(), 'Remember this day.\nAlways keep it.')
})

test('stale boundaries do not highlight new speech and language changes clear the highlight', async (t) => {
  const page = await setup(t)
  await page.locator('#btn-verse-audio').click()
  await page.evaluate(() => {
    const utterance = window.speechTest.utterances[0]
    utterance.onboundary({ name: 'word', charIndex: utterance.text.indexOf('Remember'), charLength: 8 })
  })
  assert.equal(await page.locator('.verse-spoken-word').count(), 1)
  await page.locator('#verse-audio-rate').selectOption('0.7')
  assert.equal(await page.locator('.verse-spoken-word').count(), 0)
  await page.evaluate(() => window.speechTest.utterances[0].onboundary({ name: 'word', charIndex: 0, charLength: 11 }))
  assert.equal(await page.locator('.verse-spoken-word').count(), 0)
  await page.evaluate(() => window.speechTest.utterances[1].onboundary({ name: 'word', charIndex: 0, charLength: 11 }))
  assert.equal(await page.locator('.verse-spoken-word').count(), 1)
  await page.locator('#btn-lang').click()
  assert.equal(await page.locator('.verse-spoken-word').count(), 0)
  assert.equal(await page.locator('#verse-body').textContent(), '한국어 말씀')
})

test('English font remains stable on return and manual font controls adjust from its current size', async (t) => {
  const page = await setup(t, { longEnglish: true })
  await page.evaluate(() => document.fonts.ready)
  const fontSize = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#verse-body')).fontSize))
  await page.locator('#font-decrease').click()
  const saved = await fontSize()
  await page.setViewportSize({ width: 768, height: 900 })
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  assert.equal(await fontSize(), saved, 'automatic fitting does not enlarge the text')
  await page.reload()
  await page.evaluate(() => document.fonts.ready)
  assert.equal(await fontSize(), saved, 'reloading keeps the last fitted size')
  await page.locator('#font-decrease').click()
  const decreased = Math.max(12, saved - 4)
  assert.equal(await fontSize(), decreased, 'decrease never enlarges text')
  await page.locator('#font-increase').click()
  assert.equal(await fontSize(), decreased + 4, 'increase adjusts from the current size')
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  assert.equal(await fontSize(), decreased + 4, 'automatic fitting keeps the manually increased size')
})

test('preserves the previously saved font size for a verse with line breaks', async (t) => {
  const page = await setup(t, { multiline: true, legacyFit: true })
  assert.equal(await page.locator('#verse-body').evaluate((el) => getComputedStyle(el).fontSize), '14px')
  await page.locator('#btn-verse-audio').click()
  await page.evaluate(() => {
    const utterance = window.speechTest.utterances[0]
    utterance.onboundary({ name: 'word', charIndex: utterance.text.indexOf('Always'), charLength: 6 })
    window.dispatchEvent(new Event('resize'))
  })
  assert.equal(await page.locator('#verse-body').evaluate((el) => getComputedStyle(el).fontSize), '14px')
})
