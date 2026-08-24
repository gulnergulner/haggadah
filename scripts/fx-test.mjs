// 축하 효과 검증: 10회 단위 소형 효과가 무작위로 나오되 직전 효과와
// 연속 중복되지 않는지, 100회에 대형 효과가 나오는지 확인한다.
// 사용: node scripts/fx-test.mjs  (사전에 vite preview가 4173 포트에 떠 있어야 함)
import { chromium } from 'playwright-core'

const BASE = 'http://localhost:4173'
const errors = []

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
})
const page = await ctx.newPage()
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
page.on('pageerror', (err) => errors.push(String(err)))

await page.goto(BASE + '/', { waitUntil: 'load' })
await page.waitForTimeout(800)

const getFx = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('haggadah.fx.v1') || '{}'))

const plusOne = page.locator('#btn-increase')
const minorHistory = []

// 10, 20, ..., 80회: 매 마일스톤마다 어떤 소형 효과가 뽑혔는지 기록
for (let round = 1; round <= 8; round++) {
  for (let i = 0; i < 10; i++) await plusOne.tap()
  await page.waitForTimeout(150)
  const fx = await getFx()
  minorHistory.push(fx.lastMinor)
  if (round === 1) {
    // 효과 산출물(색종이 캔버스 또는 .fx-* DOM)이 실제로 생기는지
    const artifact = await page.evaluate(() =>
      !!document.querySelector('canvas, .fx-emoji, .fx-ripple, .counter.fx-pulse'))
    console.log('첫 마일스톤 효과 산출물 존재:', artifact)
    await page.screenshot({ path: 'scripts/shot-fx-minor.png' })
  }
  await page.waitForTimeout(500)
}
console.log('소형 효과 선택 이력(인덱스):', minorHistory.join(', '))
const repeats = minorHistory.filter((v, i) => i > 0 && v === minorHistory[i - 1])
console.log('연속 중복 횟수:', repeats.length, repeats.length === 0 ? '(통과)' : '(실패!)')

// 100회 달성 → 대형 효과
for (let i = 0; i < 20; i++) await plusOne.tap()
await page.waitForTimeout(600)
const fx = await getFx()
console.log('100회 카운트:', await page.locator('#counter').textContent())
console.log('대형 효과 인덱스(lastGrand):', fx.lastGrand)
await page.screenshot({ path: 'scripts/shot-fx-grand.png' })

// 200회에서 대형 효과가 직전과 다른지 (빠르게 evaluate로 클릭)
await page.evaluate(() => {
  const btn = document.getElementById('btn-increase')
  for (let i = 0; i < 100; i++) btn.click()
})
await page.waitForTimeout(600)
const fx2 = await getFx()
console.log('200회 대형 효과 인덱스:', fx2.lastGrand,
  fx2.lastGrand !== fx.lastGrand ? '(직전과 다름, 통과)' : '(직전과 동일, 실패!)')

console.log('콘솔 에러:', errors.length ? errors : '없음')
await browser.close()
