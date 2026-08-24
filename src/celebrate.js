// 마일스톤 축하 효과.
// 10회 단위 → 소형 효과 풀, 100회 단위 → 대형 효과 풀에서 무작위로 하나 실행.
// 직전에 나온 효과는 localStorage에 기억해 두고 연속으로 나오지 않게 제외한다.

// canvas-confetti는 첫 효과 때 지연 로드 (초기 번들 0바이트)
let confettiPromise = null
function getConfetti() {
  confettiPromise ||= import('canvas-confetti').then((m) => m.default)
  return confettiPromise
}

const FX_KEY = 'haggadah.fx.v1'

function loadFxState() {
  try { return JSON.parse(localStorage.getItem(FX_KEY)) || {} } catch { return {} }
}

function saveFxState(state) {
  try { localStorage.setItem(FX_KEY, JSON.stringify(state)) } catch { /* 무시 */ }
}

// 직전 효과를 제외한 나머지 중에서 균등 추첨
function pickNext(poolSize, last) {
  if (poolSize <= 1) return 0
  if (typeof last !== 'number' || last < 0 || last >= poolSize) {
    return Math.floor(Math.random() * poolSize)
  }
  const i = Math.floor(Math.random() * (poolSize - 1))
  return i >= last ? i + 1 : i
}

const rand = (min, max) => min + Math.random() * (max - min)
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)]

function spawn(el, ms) {
  document.body.appendChild(el)
  setTimeout(() => el.remove(), ms)
}

function flashBackground() {
  document.body.classList.add('background-flash')
  setTimeout(() => document.body.classList.remove('background-flash'), 3000)
}

// ---------- 소형 효과 (10, 20, ..., 90회) ----------

// 하늘에서 터지는 입자 불꽃놀이 2발
async function fxFirework() {
  const confetti = await getConfetti()
  confetti({
    particleCount: 60, spread: 360, startVelocity: 28, gravity: 0.9,
    ticks: 80, scalar: 0.9, origin: { x: rand(0.25, 0.75), y: rand(0.25, 0.45) },
  })
  setTimeout(() => confetti({
    particleCount: 45, spread: 360, startVelocity: 24, gravity: 0.9,
    ticks: 70, scalar: 0.8, origin: { x: rand(0.25, 0.75), y: rand(0.25, 0.45) },
  }), 250)
}

// 양쪽 아래에서 쏘아 올리는 색종이 캐논
async function fxSideCannons() {
  const confetti = await getConfetti()
  confetti({ particleCount: 50, angle: 60, spread: 60, startVelocity: 45, origin: { x: 0, y: 0.8 } })
  confetti({ particleCount: 50, angle: 120, spread: 60, startVelocity: 45, origin: { x: 1, y: 0.8 } })
}

// 황금 별 반짝임
async function fxGoldStars() {
  const confetti = await getConfetti()
  const gold = {
    particleCount: 35, spread: 100, startVelocity: 25, ticks: 90, scalar: 1.2,
    shapes: ['star'], colors: ['#FFD700', '#FFA500', '#FFE066', '#FFF2B2'],
    origin: { y: 0.4 },
  }
  confetti(gold)
  setTimeout(() => confetti({ ...gold, particleCount: 25, scalar: 0.9 }), 200)
}

// 이모지가 아래에서 떠오르는 효과
function fxEmojiFloat() {
  const emojis = ['🙏', '✨', '📖', '💛', '🕊️']
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      const el = document.createElement('span')
      el.className = 'fx-emoji'
      el.textContent = pickOne(emojis)
      el.style.left = `${rand(5, 88)}vw`
      el.style.setProperty('--size', `${rand(22, 40)}px`)
      el.style.setProperty('--dur', `${rand(1.8, 2.8)}s`)
      el.style.setProperty('--rot', `${rand(-30, 30)}deg`)
      spawn(el, 3000)
    }, i * 120)
  }
}

// 카운터 숫자 펄스 + 파동 링 + 발밑 색종이 팝
async function fxCounterPop() {
  const counterEl = document.getElementById('counter')
  if (counterEl) {
    counterEl.classList.remove('fx-pulse')
    void counterEl.offsetWidth // 애니메이션 재시작
    counterEl.classList.add('fx-pulse')
    const r = counterEl.getBoundingClientRect()
    const ring = document.createElement('div')
    ring.className = 'fx-ripple'
    ring.style.left = `${r.left + r.width / 2}px`
    ring.style.top = `${r.top + r.height / 2}px`
    spawn(ring, 800)
  }
  const confetti = await getConfetti()
  confetti({ particleCount: 30, spread: 70, startVelocity: 35, origin: { y: 0.85 } })
}

// ---------- 대형 효과 (100, 200, ...회) ----------

// 화면 곳곳에서 연속으로 터지는 불꽃놀이 쇼
async function gxFireworksShow() {
  const confetti = await getConfetti()
  for (let i = 0; i < 6; i++) {
    setTimeout(() => confetti({
      particleCount: 80, spread: 360, startVelocity: 30, ticks: 90,
      origin: { x: rand(0.15, 0.85), y: rand(0.2, 0.5) },
    }), i * 450)
  }
}

// 풍선 떼 + 배경 플래시
function gxBalloonsAndFlash() {
  flashBackground()
  const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899']
  for (let i = 0; i < 14; i++) {
    setTimeout(() => {
      const balloon = document.createElement('div')
      balloon.className = 'fx-balloon'
      balloon.style.left = `${rand(2, 90)}vw`
      balloon.style.setProperty('--dur', `${rand(3.5, 6)}s`)
      const body = document.createElement('div')
      body.className = 'fx-balloon-body'
      body.style.setProperty('--color', pickOne(colors))
      body.style.setProperty('--size', `${rand(38, 58)}px`)
      body.style.animationDelay = `-${rand(0, 1.6)}s` // 흔들림 위상 랜덤
      balloon.appendChild(body)
      spawn(balloon, 6500)
    }, i * 200)
  }
}

// 하늘에서 내리는 색종이 비
async function gxConfettiRain() {
  const confetti = await getConfetti()
  for (let i = 0; i < 12; i++) {
    setTimeout(() => confetti({
      particleCount: 25, angle: 90, spread: 55, startVelocity: 15,
      gravity: 0.8, ticks: 150, origin: { x: rand(0, 1), y: -0.1 },
    }), i * 250)
  }
}

// 골든 피날레: 배경 플래시 + 황금 별 폭발 + 축하 이모지
async function gxGoldenFinale() {
  flashBackground()
  const emojis = ['🎉', '🏆', '👑', '✨']
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      const el = document.createElement('span')
      el.className = 'fx-emoji'
      el.textContent = pickOne(emojis)
      el.style.left = `${rand(5, 88)}vw`
      el.style.setProperty('--size', `${rand(30, 48)}px`)
      el.style.setProperty('--dur', `${rand(2, 3)}s`)
      el.style.setProperty('--rot', `${rand(-30, 30)}deg`)
      spawn(el, 3200)
    }, i * 180)
  }
  const confetti = await getConfetti()
  const gold = {
    particleCount: 60, spread: 360, startVelocity: 30, ticks: 100, scalar: 1.3,
    shapes: ['star'], colors: ['#FFD700', '#FFA500', '#FFE066', '#FFF2B2'],
  }
  for (let i = 0; i < 3; i++) {
    setTimeout(() => confetti({ ...gold, origin: { x: rand(0.2, 0.8), y: rand(0.25, 0.5) } }), i * 500)
  }
}

// ---------- 공개 API ----------

const MINOR_FX = [fxFirework, fxSideCannons, fxGoldStars, fxEmojiFloat, fxCounterPop]
const GRAND_FX = [gxFireworksShow, gxBalloonsAndFlash, gxConfettiRain, gxGoldenFinale]

export function celebrateMinor() {
  const state = loadFxState()
  const i = pickNext(MINOR_FX.length, state.lastMinor)
  state.lastMinor = i
  saveFxState(state)
  navigator.vibrate?.(20)
  MINOR_FX[i]()
}

export function celebrateGrand() {
  const state = loadFxState()
  const i = pickNext(GRAND_FX.length, state.lastGrand)
  state.lastGrand = i
  saveFxState(state)
  navigator.vibrate?.([40, 60, 40])
  GRAND_FX[i]()
}
