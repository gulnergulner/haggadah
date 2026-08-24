import './styles/base.css'
import './styles/main.css'
import { createCounter } from './counter.js'
import { cachedVerse, cacheIsFresh, fetchLatest } from './verse.js'
import { triggerFirework, flashBackground, releaseBalloons } from './celebrate.js'
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
    }
  })
}

els.btnLang.addEventListener('click', () => {
  counter.setPref('lang', counter.getPref('lang') === 'ko' ? 'en' : 'ko')
  renderVerse()
})

// ---------- 글자 크기 조절 (기존과 동일하게 verseFontSize 키 사용) ----------
const DEFAULT_FONT_SIZE = 20
let verseFontSize =
  parseInt(localStorage.getItem('verseFontSize'), 10) || DEFAULT_FONT_SIZE

function applyFontSize() {
  els.body.style.fontSize = `${verseFontSize}px`
}

els.fontIncrease.addEventListener('click', () => {
  verseFontSize += 4
  localStorage.setItem('verseFontSize', verseFontSize)
  applyFontSize()
})
els.fontDecrease.addEventListener('click', () => {
  verseFontSize = Math.max(12, verseFontSize - 4)
  localStorage.setItem('verseFontSize', verseFontSize)
  applyFontSize()
})
applyFontSize()

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

  // 10의 배수마다 불꽃놀이, 100번 달성 시 특별 효과 (기존과 동일)
  if (n % 10 === 0) triggerFirework()
  if (n === 100) {
    triggerFirework()
    flashBackground()
    releaseBalloons()
  }
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
