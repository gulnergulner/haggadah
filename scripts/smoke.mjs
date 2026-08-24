// 로컬 스모크 테스트: 설치된 Edge를 headless로 띄워 성도 페이지를 모바일
// 뷰포트로 열고 +1 버튼/칭호/localStorage 유지 여부를 확인한다.
// 사용: node scripts/smoke.mjs  (사전에 vite preview가 4173 포트에 떠 있어야 함)
import { chromium } from 'playwright-core'

const BASE = 'http://localhost:4173'
const errors = []

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Smoke',
})
const page = await ctx.newPage()
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
page.on('pageerror', (err) => errors.push(String(err)))

await page.goto(BASE + '/', { waitUntil: 'load' }); await page.waitForTimeout(1200)
await page.screenshot({ path: 'scripts/shot-initial.png' })

console.log('날짜 표시:', JSON.stringify(await page.locator('#date').textContent()))
console.log('말씀 본문:', JSON.stringify(await page.locator('#verse-body').textContent()))

// 21번 탭 → 카운트 21 + 칭호가 '말씀 지킴이'로 바뀌는지
const plusOne = page.locator('#btn-increase')
for (let i = 0; i < 21; i++) await plusOne.tap()
await page.waitForTimeout(400)
console.log('21회 탭 후 카운트:', await page.locator('#counter').textContent())
console.log('칭호:', await page.locator('#title-badge').textContent())
await page.screenshot({ path: 'scripts/shot-after-taps.png' })

// 새로고침 후 카운트 유지 확인
await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1200)
console.log('새로고침 후 카운트:', await page.locator('#counter').textContent())

// 언어 전환 → 버튼 라벨 변경 확인
await page.locator('#btn-lang').tap()
console.log('전환 후 언어 버튼:', await page.locator('#btn-lang').textContent())
console.log('전환 후 리셋 버튼:', await page.locator('#btn-reset').textContent())
await page.locator('#btn-lang').tap()

// 리셋 버튼
await page.locator('#btn-reset').tap()
console.log('리셋 후 카운트:', await page.locator('#counter').textContent())

// 관리자 페이지 로드
await page.goto(BASE + '/admin.html', { waitUntil: 'load' }); await page.waitForTimeout(1200)
await page.screenshot({ path: 'scripts/shot-admin.png' })

console.log('콘솔 에러:', errors.length ? errors : '없음')
await browser.close()
