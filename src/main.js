import './styles/base.css'
import './styles/main.css'
import { createCounter } from './counter.js'
import { cachedVerse, cacheIsFresh, fetchLatest } from './verse.js'
import { celebrateMinor, celebrateGrand } from './celebrate.js'
import * as wakelock from './wakelock.js'

// 20회 단위 칭호 (기존 haggadah.html과 동일)
const TITLES = [
  '🌱 새싹', // 1~19번
  '⭐ 말씀 지킴이', // 20~39번
  '🔥 신앙의 불꽃', // 40~59번
  '💎 믿음의 보석', // 60~79번
  '🌟 빛의 증인', // 80~99번
  '🏆 말씀의 챔피언', // 100번 이상
]

const $ = (id) => document.getElementById(id)
const els = {
  date: $('date'),
  badge: $('title-badge'),
  ref: $('verse-ref'),
  body: $('verse-body'),
  counter: $('counter'),
  btnReset: $('btn-reset'),
  btnLang: $('btn-lang'),
  btnIncrease: $('btn-increase'),
  fontDecrease: $('font-decrease'),
  fontIncrease: $('font-increase'),
}

const counter = createCounter()
let verse = cachedVerse()

// ---------- 날짜 ----------
function renderDate() {
  const today = new Date()
  els.date.innerText =
    `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`
}

// ---------- 칭호 ----------
function updateTitleBadge(count) {
  let idx = Math.floor(count / 20)
  if (idx >= TITLES.length) idx = TITLES.length - 1
  els.badge.innerText = TITLES[idx]
}

// ---------- 말씀 렌더 ----------
function renderVerse() {
  const lang = counter.getPref('lang')
  const ko = lang === 'ko'
  els.btnLang.innerText = ko ? '영문' : 'Korean'
  els.btnReset.innerText = ko ? '리셋' : 'Reset'
  if (!verse) {
    els.ref.innerText = ''
    els.body.innerText = ko
      ? '아직 게시된 말씀이 없습니다.'
      : 'No verse has been published yet.'
    return
  }
  const en = !ko && verse.bodyEn
  const ref = (en ? verse.referenceEn : verse.reference) || ''
  els.ref.innerText = ref ? `📖${ref}` : ''
  els.body.innerText = (en ? verse.bodyEn : verse.bodyKo) || ''
}

renderDate()
renderVerse()
if (!cacheIsFresh()) {
  fetchLatest().then((latest) => {
    if (latest) {
      verse = latest
      renderVerse()
      applyFontSize()
    }
  })
}

els.btnLang.addEventListener('click', () => {
  counter.setPref('lang', counter.getPref('lang') === 'ko' ? 'en' : 'ko')
  renderVerse()
  applyFontSize()
})

// ---------- 글자 크기: 화면에 잘리지 않는 최대 크기로 자동 맞춤 ----------
// 사용자는 -/+ 버튼으로 자동 크기에서 줄이는 방향의 보정만 저장한다.
const MIN_FONT = 12
const MAX_FONT = 44
let fontDelta = parseInt(localStorage.getItem('verseFontDelta'), 10) || 0

const verseMain = document.querySelector('.verse-main')
const verseCard = document.querySelector('.verse-card')

// 이진 탐색으로 컨테이너를 넘치지 않는 최대 폰트 크기를 찾는다
function fitFontSize() {
  const avail = verseMain.clientHeight
  let lo = MIN_FONT
  let hi = MAX_FONT
  let best = MIN_FONT
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    els.body.style.fontSize = `${mid}px`
    if (verseCard.scrollHeight <= avail) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}

function applyFontSize() {
  const fit = fitFontSize()
  const size = Math.max(MIN_FONT, Math.min(fit, fit + fontDelta))
  els.body.style.fontSize = `${size}px`
}

els.fontIncrease.addEventListener('click', () => {
  fontDelta = Math.min(0, fontDelta + 4)
  localStorage.setItem('verseFontDelta', fontDelta)
  applyFontSize()
})
els.fontDecrease.addEventListener('click', () => {
  fontDelta = Math.max(-(MAX_FONT - MIN_FONT), fontDelta - 4)
  localStorage.setItem('verseFontDelta', fontDelta)
  applyFontSize()
})

applyFontSize()
window.addEventListener('resize', applyFontSize)
document.fonts?.ready.then(applyFontSize) // 세리프 폰트 로드 후 재계산

// ---------- 카운터 ----------
function renderCount(n) {
  els.counter.innerText = n
  updateTitleBadge(n)
}

renderCount(counter.get())

// 자정 넘김: 다시 화면에 보일 때 오늘 날짜/카운트로 갱신
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    renderDate()
    renderCount(counter.get())
  }
})

els.btnIncrease.addEventListener('click', () => {
  const n = counter.increment()
  navigator.vibrate?.(10)
  renderCount(n)

  // 10회마다 소형, 100회마다 대형 효과 — 풀에서 무작위, 직전 효과는 제외
  if (n % 100 === 0) celebrateGrand()
  else if (n % 10 === 0) celebrateMinor()
})

els.btnReset.addEventListener('click', () => {
  renderCount(counter.reset())
})

// ---------- 화면 꺼짐 방지 (버튼 없이 첫 조작 시 자동 활성화) ----------
if (wakelock.supported) {
  let wakeRequested = false
  els.btnIncrease.addEventListener('click', () => {
    if (wakeRequested) return
    wakeRequested = true
    wakelock.enable()
    wakelock.reacquireOnVisible(() => true)
  })
}
