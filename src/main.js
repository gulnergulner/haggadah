import './styles/base.css'
import './styles/main.css'
import { createCounter } from './counter.js'
import { cachedVerse, cacheIsFresh, fetchLatest } from './verse.js'
import { checkMilestone, celebrate } from './celebrate.js'
import * as wakelock from './wakelock.js'

const GOAL = 100
const CIRC = 2 * Math.PI * 54 // ring r=54

const $ = (id) => document.getElementById(id)
const els = {
  ref: $('verse-ref'),
  title: $('verse-title'),
  body: $('verse-body'),
  scroll: $('verse-scroll'),
  ringWrap: $('ring-wrap'),
  ringBar: $('ring-bar'),
  countNum: $('count-num'),
  tapZone: $('tap-zone'),
  btnMinus: $('btn-minus'),
  btnReset: $('btn-reset'),
  btnLang: $('btn-lang'),
  btnWake: $('btn-wake'),
  doneOverlay: $('done-overlay'),
  btnDoneClose: $('btn-done-close'),
}

const counter = createCounter()
let verse = cachedVerse()

// ---------- 말씀 렌더 ----------
function renderVerse() {
  const lang = counter.getPref('lang')
  els.btnLang.textContent = lang === 'ko' ? 'English' : '한글'
  if (!verse) {
    els.ref.textContent = ''
    els.title.textContent = '아직 게시된 말씀이 없습니다'
    els.body.textContent = '관리자가 이번 주 하가다를 게시하면 이곳에 표시됩니다.'
    return
  }
  const en = lang === 'en' && verse.bodyEn
  els.ref.textContent = (en ? verse.referenceEn : verse.reference) || ''
  els.title.textContent = (en ? verse.titleEn : verse.titleKo) || ''
  els.body.textContent = (en ? verse.bodyEn : verse.bodyKo) || ''
}

renderVerse()
if (!cacheIsFresh()) {
  fetchLatest().then((latest) => {
    if (latest && latest.id !== verse?.id) {
      verse = latest
      renderVerse()
      els.scroll.scrollTop = 0
    } else if (latest) {
      verse = latest
      renderVerse()
    }
  })
}

els.btnLang.addEventListener('click', () => {
  counter.setPref('lang', counter.getPref('lang') === 'ko' ? 'en' : 'ko')
  renderVerse()
})

// ---------- 카운터 렌더 ----------
function renderCount(n, pop = false) {
  els.countNum.textContent = n
  const pct = Math.min(n / GOAL, 1)
  els.ringBar.style.strokeDashoffset = CIRC * (1 - pct)
  els.ringWrap.classList.toggle('complete', n >= GOAL)
  if (pop) {
    els.countNum.classList.remove('pop')
    void els.countNum.offsetWidth
    els.countNum.classList.add('pop')
  }
}

renderCount(counter.get())

// 자정 넘김: 다시 화면에 보일 때 오늘 카운트로 갱신
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') renderCount(counter.get())
})

// ---------- 탭(증가) ----------
function spawnPlusOne(e) {
  const rect = els.tapZone.getBoundingClientRect()
  const span = document.createElement('span')
  span.className = 'plus-one'
  span.textContent = '+1'
  const x = e.clientX ? e.clientX - rect.left : rect.width / 2
  const y = e.clientY ? e.clientY - rect.top : rect.height / 2
  span.style.left = `${x}px`
  span.style.top = `${y}px`
  els.tapZone.appendChild(span)
  span.addEventListener('animationend', () => span.remove())
}

function handleTap(e) {
  const prev = counter.get()
  const next = counter.increment()
  navigator.vibrate?.(10)
  renderCount(next, true)
  spawnPlusOne(e)
  const milestone = checkMilestone(prev, next)
  if (milestone) {
    celebrate(milestone)
    if (milestone === 100) {
      els.doneOverlay.hidden = false
    }
  }
}

els.tapZone.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary) return // 멀티터치 중복 카운트 방지
  handleTap(e)
})
// 키보드 사용자용 (버튼 기본 click은 pointerdown과 중복되므로 keydown만 처리)
els.tapZone.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
    e.preventDefault()
    handleTap(e)
  }
})
els.tapZone.addEventListener('contextmenu', (e) => e.preventDefault())

els.btnDoneClose.addEventListener('click', () => {
  els.doneOverlay.hidden = true
})

// ---------- 보정/리셋 ----------
els.btnMinus.addEventListener('click', () => renderCount(counter.decrement()))
els.btnReset.addEventListener('click', () => {
  if (confirm('오늘 횟수를 0으로 되돌릴까요?')) renderCount(counter.reset())
})

// ---------- 화면 꺼짐 방지 ----------
function renderWake() {
  const on = !!counter.getPref('wakeLock')
  els.btnWake.setAttribute('aria-pressed', String(on))
  els.btnWake.classList.toggle('chip-on', on)
}

if (wakelock.supported) {
  els.btnWake.hidden = false
  renderWake()
  if (counter.getPref('wakeLock')) wakelock.enable()
  wakelock.reacquireOnVisible(() => !!counter.getPref('wakeLock'))
  els.btnWake.addEventListener('click', async () => {
    if (counter.getPref('wakeLock')) {
      wakelock.disable()
      counter.setPref('wakeLock', false)
    } else {
      const ok = await wakelock.enable()
      counter.setPref('wakeLock', ok)
    }
    renderWake()
  })
}
