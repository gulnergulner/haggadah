// Run against a local Vite server: node --test scripts/speech-test.mjs
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright-core'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5173'
let browser
before(async () => { browser = await chromium.launch({ channel: 'msedge', headless: true }) })
after(async () => { await browser?.close() })

async function setup(t, { supported = true, english = true, longEnglish = false, multiline = false, legacyFit = false, fallbackHighlight = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 320, height: 667 }, timezoneId: 'Asia/Seoul' })
  t.after(() => context.close())
  const page = await context.newPage()
  await page.clock.install({ time: new Date('2026-09-06T08:00:00+09:00') })
  await page.route('**/api/me', (route) => route.fulfill({ json: { loggedIn: false } }))
  await page.route('**/rest/v1/haggadot**', (route) => route.fulfill({ json: [{
    id: '2026-08-30', reference: '이전 말씀', reference_en: 'Previous reference',
    body_ko: '이전 본문', body_en: 'Previous English verse',
  }] }))
  await page.addInitScript(({ supported, english, longEnglish, multiline, legacyFit, fallbackHighlight }) => {
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
      if (legacyFit) {
        localStorage.setItem('verseFontDelta', '-4')
        localStorage.setItem('haggadah.verseFontFit.v1', JSON.stringify({
          key: JSON.stringify(['2026-09-06', 'en', '📖 Deuteronomy 16:3', 'Remember this day.Always keep it.', -4]),
          size: 14,
        }))
      }
      sessionStorage.setItem('speech-test-initialized', '1')
    }
    window.speechTest = { utterances: [], canceled: 0, paused: 0, resumed: 0 }
    if (fallbackHighlight) Object.defineProperty(CSS, 'highlights', { configurable: true, value: undefined })
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
  }, { supported, english, longEnglish, multiline, legacyFit, fallbackHighlight })
  await page.goto(BASE)
  return page
}

async function highlightedText(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector('.verse-spoken-overlay')?.getBoundingClientRect()
    if (!overlay) return ''
    for (const element of [document.getElementById('verse-ref'), document.getElementById('verse-body')]) {
      const text = element.firstChild
      if (!text || text.nodeType !== Node.TEXT_NODE) continue
      for (const match of text.textContent.matchAll(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)) {
        const range = document.createRange()
        range.setStart(text, match.index)
        range.setEnd(text, match.index + match[0].length)
        for (const rect of range.getClientRects()) {
          if (Math.abs(rect.x - overlay.x) < 0.1 && Math.abs(rect.y - overlay.y) < 0.1
            && Math.abs(rect.width - overlay.width) < 0.1) return match[0]
        }
      }
    }
    return ''
  })
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
  assert.equal(await unsupported.locator('#btn-verse-audio').innerText(), 'No audio')
  assert.ok(await unsupported.locator('#verse-audio-rate').isDisabled())
  assert.match(await unsupported.locator('#btn-verse-audio').getAttribute('title'), /not supported/)
  const missing = await setup(t, { english: false })
  assert.ok(await missing.locator('#btn-verse-audio').isDisabled())
  assert.equal(await missing.locator('#btn-verse-audio').innerText(), 'No verse')
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
  await speed.selectOption('0.5')
  assert.equal(await page.evaluate(() => window.speechTest.canceled), 1)
  assert.equal(await page.evaluate(() => window.speechTest.utterances[1].rate), 0.5)
  assert.equal(await button.innerText(), 'Pause')
  await page.evaluate(() => window.speechTest.utterances[0].onend())
  assert.equal(await button.innerText(), 'Pause')
  await page.reload()
  assert.equal(await speed.inputValue(), '0.5')
  await button.click()
  assert.equal(await page.evaluate(() => window.speechTest.utterances[0].rate), 0.5)
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

test('speed stays centered below the verse with play and pause to its right', async (t) => {
  const page = await setup(t, { longEnglish: true })
  const button = page.locator('#btn-verse-audio')
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 667 })
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
      assert.ok(layout.body.bottom <= layout.audio.top, `${width}px ${state}: controls are below text`)
      assert.ok(Math.abs((layout.speed.left + layout.speed.right) / 2 - width / 2) < 1,
        `${width}px ${state}: speed is centered on screen`)
      assert.ok(layout.speed.right <= layout.button.left, `${width}px ${state}: play is to the right`)
      assert.ok(layout.button.right <= width && layout.width <= width, `${width}px ${state}: controls fit screen`)
      assert.ok(Math.abs(layout.speed.top - layout.button.top) < 2, `${width}px ${state}: controls share a row`)
    }
    await page.evaluate(() => window.speechTest.utterances.at(-1).onend())
  }
})

test('highlights the spoken reference and words, preserves line breaks, and clears on completion', async (t) => {
  const page = await setup(t, { multiline: true })
  const button = page.locator('#btn-verse-audio')
  await button.click()
  await page.evaluate(() => window.speechTest.utterances[0].onboundary({ name: 'word', charIndex: 0, charLength: 11 }))
  assert.equal(await highlightedText(page), 'Deuteronomy')
  await page.evaluate(() => {
    const utterance = window.speechTest.utterances[0]
    utterance.onboundary({ name: 'word', charIndex: utterance.text.indexOf('Remember'), charLength: 8 })
  })
  assert.equal(await highlightedText(page), 'Remember')
  assert.equal(await page.locator('#verse-body').textContent(), 'Remember this day.\nAlways keep it.')
  await button.click()
  assert.equal(await highlightedText(page), 'Remember', 'pause keeps the current highlight')
  await button.click()
  await page.evaluate(() => {
    const utterance = window.speechTest.utterances[0]
    utterance.onboundary({ name: 'word', charIndex: utterance.text.indexOf('Always'), charLength: 0 })
  })
  assert.equal(await highlightedText(page), 'Always', 'word boundaries without length are supported')
  assert.equal(await page.locator('#verse-body').innerText(), 'Remember this day.\nAlways keep it.')
  await page.evaluate(() => window.speechTest.utterances[0].onend())
  assert.equal(await highlightedText(page), '')
  assert.equal(await page.locator('#verse-body').textContent(), 'Remember this day.\nAlways keep it.')
})

test('stale boundaries do not highlight new speech and language changes clear the highlight', async (t) => {
  const page = await setup(t)
  await page.locator('#btn-verse-audio').click()
  await page.evaluate(() => {
    const utterance = window.speechTest.utterances[0]
    utterance.onboundary({ name: 'word', charIndex: utterance.text.indexOf('Remember'), charLength: 8 })
  })
  assert.equal(await highlightedText(page), 'Remember')
  await page.locator('#verse-audio-rate').selectOption('0.7')
  assert.equal(await highlightedText(page), '')
  await page.evaluate(() => window.speechTest.utterances[0].onboundary({ name: 'word', charIndex: 0, charLength: 11 }))
  assert.equal(await highlightedText(page), '')
  await page.evaluate(() => window.speechTest.utterances[1].onboundary({ name: 'word', charIndex: 0, charLength: 11 }))
  assert.equal(await highlightedText(page), 'Deuteronomy')
  await page.locator('#btn-lang').click()
  assert.equal(await highlightedText(page), '')
  assert.equal(await page.locator('#verse-body').textContent(), '한국어 말씀')
})

test('highlight keeps following words when the same verse is refreshed during playback', async (t) => {
  const page = await setup(t)
  await page.locator('#btn-verse-audio').click()
  await page.evaluate(() => {
    const utterance = window.speechTest.utterances[0]
    utterance.onboundary({ name: 'word', charIndex: utterance.text.indexOf('Remember'), charLength: 8 })
    window.bodyBeforeRefresh = document.querySelector('#verse-body').firstChild
  })
  assert.equal(await highlightedText(page), 'Remember')
  await page.evaluate(async () => {
    window.dispatchEvent(new Event('online'))
    await Promise.resolve()
    await Promise.resolve()
  })
  assert.equal(await page.evaluate(() => document.querySelector('#verse-body').firstChild === window.bodyBeforeRefresh), true)
  await page.evaluate(() => {
    const utterance = window.speechTest.utterances[0]
    utterance.onboundary({ name: 'word', charIndex: utterance.text.indexOf('this'), charLength: 4 })
  })
  assert.equal(await highlightedText(page), 'this')
})

for (const fallbackHighlight of [false, true]) {
  test(`spoken-word highlighting moves while preserving layout (CSS Highlight API ${fallbackHighlight ? 'unavailable' : 'available'})`, async (t) => {
    const page = await setup(t, { longEnglish: true, fallbackHighlight })
    await page.evaluate(() => document.fonts.ready)
    await page.locator('#btn-verse-audio').click()
    const measure = () => page.evaluate(() => {
      const element = document.getElementById('verse-body')
      const node = element.firstChild
      const positions = []
      for (let i = 0; i < node.length; i++) {
        const range = document.createRange()
        range.setStart(node, i)
        range.setEnd(node, i + 1)
        positions.push([...range.getClientRects()].map((r) => [r.x, r.y, r.width, r.height]))
      }
      const rect = element.getBoundingClientRect()
      return { positions, bounds: [rect.x, rect.y, rect.width, rect.height] }
    })
    await page.evaluate(() => {
      window.originalVerseNode = document.querySelector('#verse-body').firstChild
      const selection = window.getSelection()
      const range = document.createRange()
      range.setStart(window.originalVerseNode, 0)
      range.setEnd(window.originalVerseNode, 2)
      selection.removeAllRanges()
      selection.addRange(range)
    })
    const initial = await measure()
    for (const word of ['Do', 'unleavened', 'affliction', 'departure']) {
      await page.evaluate((word) => {
        const utterance = window.speechTest.utterances[0]
        utterance.onboundary({ name: 'word', charIndex: utterance.text.indexOf(word), charLength: word.length })
      }, word)
      assert.equal(await page.evaluate(() => document.querySelector('#verse-body').firstChild === window.originalVerseNode), true)
      assert.equal(await page.evaluate(() => window.getSelection().toString()), 'Do', 'user text selection is preserved')
      assert.deepEqual(await measure(), initial, `${word}: text and line positions do not change`)
      assert.equal(await highlightedText(page), word, `${word}: highlight follows the spoken word`)
    }
    if (fallbackHighlight) {
      const geometry = await page.evaluate(() => {
        const text = document.querySelector('#verse-body').firstChild
        const range = document.createRange()
        const start = text.textContent.indexOf('departure')
        range.setStart(text, start)
        range.setEnd(text, start + 'departure'.length)
        const target = range.getBoundingClientRect()
        const overlay = document.querySelector('.verse-spoken-overlay').getBoundingClientRect()
        return { target: [target.x, target.y, target.width, target.height],
          overlay: [overlay.x, overlay.y, overlay.width, overlay.height] }
      })
      assert.deepEqual(geometry.overlay, geometry.target)
    }
    await page.evaluate(() => window.speechTest.utterances[0].onend())
    assert.equal(await page.locator('.verse-spoken-overlay').count(), 0)
    assert.equal(await highlightedText(page), '')
    assert.deepEqual(await measure(), initial, 'text stays in place after playback')
  })
}

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

test('fallback highlight follows the word after the viewport changes', async (t) => {
  const page = await setup(t, { longEnglish: true, fallbackHighlight: true })
  await page.locator('#btn-verse-audio').click()
  await page.evaluate(() => {
    const utterance = window.speechTest.utterances[0]
    utterance.onboundary({ name: 'word', charIndex: utterance.text.indexOf('unleavened'), charLength: 10 })
  })
  await page.setViewportSize({ width: 375, height: 667 })
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  await page.waitForFunction(() => {
    const text = document.querySelector('#verse-body').firstChild
    const range = document.createRange()
    const start = text.textContent.indexOf('unleavened')
    range.setStart(text, start)
    range.setEnd(text, start + 10)
    const target = range.getBoundingClientRect()
    const overlay = document.querySelector('.verse-spoken-overlay')?.getBoundingClientRect()
    return overlay && Math.abs(overlay.x - target.x) < 0.1 && Math.abs(overlay.y - target.y) < 0.1
  })
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
