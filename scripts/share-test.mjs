import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { chromium } from 'playwright-core'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5173'
let browser
before(async () => { browser = await chromium.launch({ channel: 'msedge', headless: true }) })
after(async () => { await browser?.close() })

async function setup(t, mode = 'native') {
  const context = await browser.newContext({ viewport: { width: 375, height: 667 } })
  t.after(() => context.close())
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/api/me', (route) => route.fulfill({ json: { loggedIn: false } }))
  await page.addInitScript((mode) => {
    const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
    d.setUTCDate(d.getUTCDate() - d.getUTCDay())
    localStorage.setItem('haggadah.verseCache', JSON.stringify({ data: {
      id: d.toISOString().slice(0, 10), reference: '시편 1:2-3', bodyKo: '말씀을 읊조려요\n주야로 묵상해요',
      bodyEn: 'Read the verse',
    } }))
    localStorage.setItem('haggadah.kakaoNudge', '1')
    const today = new Date()
    const day = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')].join('-')
    localStorage.setItem('haggadah.v1', JSON.stringify({
      lang: 'ko', counts: { [day]: 37 }, total: 500, achievedDays: 4, bestStreak: 2,
    }))
    window.shared = []
    window.copied = []
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => mode !== 'unsupported' })
    Object.defineProperty(navigator, 'share', { configurable: true,
      value: mode === 'clipboard' || mode === 'copy-error' ? undefined : async (data) => {
        window.shared.push(data)
        if (mode === 'cancel') throw new DOMException('Cancelled', 'AbortError')
        if (mode === 'share-error') throw new DOMException('Unavailable', 'NotAllowedError')
        if (mode === 'pending') await new Promise((resolve) => { window.finishShare = resolve })
      },
    })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (text) => {
        if (mode === 'copy-error') throw new Error('clipboard denied')
        window.copied.push(text)
      },
    } })
  }, mode)
  await page.goto(BASE)
  await page.waitForFunction(() => document.getElementById('counter').innerText === '37')
  return { page, errors }
}

test('share sends only current count text, including increments, reset, and English view', async (t) => {
  const { page, errors } = await setup(t)
  await page.locator('#btn-share').click()
  assert.deepEqual(await page.evaluate(() => window.shared), [{ text: '37번 읊조렸습니다.\n말씀을 읊조려요\n주야로 묵상해요 [시편 1장 2-3절]' }])
  await page.locator('#btn-increase').click()
  await page.locator('#btn-lang').click()
  assert.equal(await page.locator('#btn-share').innerText(), 'Share')
  await page.locator('#btn-share').click()
  await page.locator('#btn-reset').click()
  await page.locator('#btn-share').click()
  assert.deepEqual(await page.evaluate(() => window.shared), [
    { text: '37번 읊조렸습니다.\n말씀을 읊조려요\n주야로 묵상해요 [시편 1장 2-3절]' }, { text: '38번 읊조렸습니다.\n말씀을 읊조려요\n주야로 묵상해요 [시편 1장 2-3절]' }, { text: '0번 읊조렸습니다.\n말씀을 읊조려요\n주야로 묵상해요 [시편 1장 2-3절]' },
  ])
  assert.deepEqual(await page.evaluate(() => window.copied), [])
  assert.deepEqual(errors, [])
})

for (const mode of ['clipboard', 'unsupported', 'share-error']) {
  test(`${mode} copies only the message and explains how to share on KakaoTalk`, async (t) => {
    const { page, errors } = await setup(t, mode)
    await page.locator('#btn-share').click()
    assert.deepEqual(await page.evaluate(() => window.copied), ['37번 읊조렸습니다.\n말씀을 읊조려요\n주야로 묵상해요 [시편 1장 2-3절]'])
    assert.match(await page.locator('#toast').innerText(), /카카오톡에 붙여 넣어/)
    assert.ok(await page.locator('#btn-share').isEnabled())
    assert.deepEqual(errors, [])
  })
}

test('cancelling the share sheet does not copy or show a success message', async (t) => {
  const { page, errors } = await setup(t, 'cancel')
  await page.locator('#btn-share').click()
  assert.deepEqual(await page.evaluate(() => window.copied), [])
  assert.ok(await page.locator('#toast').isHidden())
  assert.ok(await page.locator('#btn-share').isEnabled())
  assert.deepEqual(errors, [])
})

test('pending share prevents duplicate clicks and preserves count at click time', async (t) => {
  const { page, errors } = await setup(t, 'pending')
  await page.locator('#btn-share').click()
  assert.ok(await page.locator('#btn-share').isDisabled())
  await page.evaluate(() => document.getElementById('btn-share').dispatchEvent(new MouseEvent('click')))
  await page.locator('#btn-increase').click()
  assert.deepEqual(await page.evaluate(() => window.shared), [{ text: '37번 읊조렸습니다.\n말씀을 읊조려요\n주야로 묵상해요 [시편 1장 2-3절]' }])
  await page.evaluate(() => window.finishShare())
  await page.waitForFunction(() => !document.getElementById('btn-share').disabled)
  assert.equal(await page.locator('#counter').innerText(), '38')
  assert.deepEqual(errors, [])
})

test('clipboard failure restores share button and displays an error', async (t) => {
  const { page, errors } = await setup(t, 'copy-error')
  await page.locator('#btn-share').click()
  assert.match(await page.locator('#toast').innerText(), /공유하지 못했습니다/)
  assert.ok(await page.locator('#btn-share').isEnabled())
  assert.deepEqual(errors, [])
})

test('three buttons fit on a small mobile screen in Korean and English', async (t) => {
  const { page } = await setup(t)
  await page.setViewportSize({ width: 320, height: 568 })
  for (let language = 0; language < 2; language++) {
    const boxes = await page.evaluate(() => ['btn-reset', 'btn-lang', 'btn-share'].map((id) => {
      const el = document.getElementById(id)
      const { x, y, width, height } = el.getBoundingClientRect()
      return { id, x, y, width, height, fits: el.scrollWidth <= el.clientWidth }
    }))
    for (const box of boxes) assert.ok(box.x >= 0 && box.x + box.width <= 320 && box.fits)
    assert.ok(boxes[0].x + boxes[0].width <= boxes[1].x)
    assert.ok(boxes[1].x + boxes[1].width <= boxes[2].x)
    assert.equal(boxes[0].y, boxes[2].y)
    await page.locator('#btn-lang').click()
  }
  await page.setViewportSize({ width: 375, height: 667 })
  await page.screenshot({ path: '/tmp/haggadah-share-button.png' })
})

test('sharing an older verse uses its full text and reference instead of latest cache', async (t) => {
  const { page, errors } = await setup(t)
  await page.route('https://wjyiovkeduosubtzflqe.supabase.co/**', (route) => route.fulfill({ json: [{
    id: '2020-01-05', reference: '신명기 12:18-19', reference_en: 'Deuteronomy 12:18-19',
    body_ko: '네 하나님 여호와 앞에서 즐거워하되\n레위인을 저버리지 말지니라',
    body_en: 'Be joyful before the Lord.',
  }] }))
  await page.locator('#btn-prev-verse').click()
  await page.waitForFunction(() => document.getElementById('verse-body').innerText.startsWith('네 하나님'))
  await page.locator('#btn-share').click()
  assert.deepEqual(await page.evaluate(() => window.shared), [{
    text: '37번 읊조렸습니다.\n네 하나님 여호와 앞에서 즐거워하되\n레위인을 저버리지 말지니라 [신명기 12장 18-19절]',
  }])
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('haggadah.verseCache')).data.bodyKo),
    '말씀을 읊조려요\n주야로 묵상해요')
  assert.deepEqual(errors, [])
})

test('missing verse does not open the share sheet or copy an incomplete message', async (t) => {
  const { page, errors } = await setup(t)
  await page.evaluate(() => {
    const cache = JSON.parse(localStorage.getItem('haggadah.verseCache'))
    delete cache.data.bodyKo
    localStorage.setItem('haggadah.verseCache', JSON.stringify(cache))
  })
  // 초기화 스크립트를 다시 실행하지 않고 같은 화면에서 캐시를 다시 읽는다.
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.waitForFunction(() => document.getElementById('verse-body').innerText === '')
  await page.locator('#btn-share').click()
  assert.deepEqual(await page.evaluate(() => window.shared), [])
  assert.deepEqual(await page.evaluate(() => window.copied), [])
  assert.match(await page.locator('#toast').innerText(), /말씀을 불러온 뒤/)
  assert.ok(await page.locator('#btn-share').isEnabled())
  assert.deepEqual(errors, [])
})
