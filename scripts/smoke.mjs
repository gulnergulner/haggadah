// 로컬 스모크 테스트: 설치된 Edge를 headless로 띄워 성도 페이지를 모바일
// 뷰포트로 열고 카운터 탭/마일스톤/localStorage 유지 여부를 확인한다.
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

await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.screenshot({ path: 'scripts/shot-initial.png' })

const title = await page.locator('#verse-title').textContent()
console.log('제목 표시:', JSON.stringify(title))

// 26번 탭 → 25 마일스톤 토스트 + 카운트 26
const tap = page.locator('#tap-zone')
for (let i = 0; i < 26; i++) await tap.tap()
await page.waitForTimeout(400)
const count = await page.locator('#count-num').textContent()
console.log('26회 탭 후 카운트:', count)
const toastVisible = await page.locator('#toast').isVisible()
const toastText = toastVisible ? await page.locator('#toast').textContent() : '(숨김)'
console.log('토스트:', toastText)
await page.screenshot({ path: 'scripts/shot-after-taps.png' })

// 새로고침 후 카운트 유지 확인
await page.reload({ waitUntil: 'networkidle' })
const countAfterReload = await page.locator('#count-num').textContent()
console.log('새로고침 후 카운트:', countAfterReload)

// -1 버튼
await page.locator('#btn-minus').tap()
console.log('-1 후 카운트:', await page.locator('#count-num').textContent())

// 관리자 페이지 로드 (설정 경고 표시 확인)
await page.goto(BASE + '/admin.html', { waitUntil: 'networkidle' })
const warnVisible = await page.locator('#config-warning').isVisible()
console.log('관리자: 설정 경고 표시 =', warnVisible)
await page.screenshot({ path: 'scripts/shot-admin.png' })

console.log('콘솔 에러:', errors.length ? errors : '없음')
await browser.close()
