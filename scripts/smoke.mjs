// 로컬 스모크 테스트: 설치된 Edge를 headless로 띄워 성도 페이지를 모바일
// 뷰포트로 열고 +1/진행바/100회 완료 카드/연속 배지/localStorage 유지를 확인한다.
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
console.log('초기 배지:', JSON.stringify(await page.locator('#title-badge').textContent()))
console.log('말씀 본문:', JSON.stringify(await page.locator('#verse-body').textContent()))

// 21번 탭 → 카운트/진행바 확인 (20회 토스트 포함)
const plusOne = page.locator('#btn-increase')
for (let i = 0; i < 20; i++) await plusOne.tap()
const toastVisible = await page.locator('#toast').isVisible()
console.log('20회 토스트:', toastVisible ? await page.locator('#toast').textContent() : '(안 보임)')
await plusOne.tap()
await page.waitForTimeout(300)
console.log('21회 탭 후 카운트:', await page.locator('#counter').textContent())
console.log('진행바 텍스트:', await page.locator('#goal-text').textContent())
await page.screenshot({ path: 'scripts/shot-after-taps.png' })

// 새로고침 후 카운트 유지 확인
await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1200)
console.log('새로고침 후 카운트:', await page.locator('#counter').textContent())

// 100회까지 탭 → 완료 카드 확인
for (let i = 0; i < 79; i++) await plusOne.tap()
await page.waitForTimeout(1800) // 대형 효과 후 카드 표시 대기
console.log('100회 후 카운트:', await page.locator('#counter').textContent())
console.log('완료 카드 표시:', await page.locator('#done-overlay').isVisible())
console.log('  연속:', await page.locator('#done-streak').textContent())
console.log('  나무:', await page.locator('#done-tree').textContent())
console.log('  누적:', await page.locator('#done-total').textContent())
console.log('  기록:', await page.locator('#done-month').textContent())
console.log('  내일:', JSON.stringify(await page.locator('#done-tomorrow').textContent()))
await page.screenshot({ path: 'scripts/shot-done-card.png' })
await page.locator('#btn-done-close').tap()
console.log('카드 닫힘:', !(await page.locator('#done-overlay').isVisible()))
console.log('달성 후 배지:', await page.locator('#title-badge').textContent())
console.log('달성 후 진행바:', await page.locator('#goal-text').textContent())
await page.screenshot({ path: 'scripts/shot-achieved.png' })

// 언어 전환 → 버튼 라벨 변경 확인
await page.locator('#btn-lang').tap()
console.log('전환 후 언어 버튼:', await page.locator('#btn-lang').textContent())
await page.locator('#btn-lang').tap()

// 리셋 버튼 → 카운트 0, 달성 취소되어 배지 원복
await page.locator('#btn-reset').tap()
console.log('리셋 후 카운트:', await page.locator('#counter').textContent())
console.log('리셋 후 배지:', await page.locator('#title-badge').textContent())

// 관리자 페이지 로드
await page.goto(BASE + '/admin.html', { waitUntil: 'load' }); await page.waitForTimeout(1200)
await page.screenshot({ path: 'scripts/shot-admin.png' })

console.log('콘솔 에러:', errors.length ? errors : '없음')
await browser.close()
