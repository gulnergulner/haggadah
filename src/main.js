import './styles/base.css'
import './styles/main.css'
import { createCounter } from './counter.js'
import { cachedVerse, cacheIsFresh, fetchLatest } from './verse.js'
import { celebrateMinor, celebrateGrand } from './celebrate.js'
import {
  GOAL, currentStreak, monthlyAchieved,
  haggadahXp, xpStateFromTotal, levelBadge,
  streakTitle, nextStreakTitle, treeStage,
} from './journey.js'
import * as sync from './sync.js'
import * as wakelock from './wakelock.js'

// 20/40/60/80회 짧은 피드백 메시지
const MILESTONE_MSGS = {
  20: '🌱 말씀이 마음에 심기고 있어요',
  40: '🌿 조금씩 익숙해지고 있어요',
  60: '🔥 절반을 훌쩍 넘었어요',
  80: '✨ 오늘의 말씀 완주가 가까워요',
}

const $ = (id) => document.getElementById(id)
const els = {
  date: $('date'),
  badge: $('title-badge'),
  ref: $('verse-ref'),
  body: $('verse-body'),
  counter: $('counter'),
  goalProgress: $('goal-progress'),
  goalFill: $('goal-fill'),
  goalText: $('goal-text'),
  toast: $('toast'),
  btnReset: $('btn-reset'),
  btnLang: $('btn-lang'),
  btnIncrease: $('btn-increase'),
  fontDecrease: $('font-decrease'),
  fontIncrease: $('font-increase'),
  doneOverlay: $('done-overlay'),
  btnDoneClose: $('btn-done-close'),
  btnStats: $('btn-stats'),
  btnDoneSync: $('btn-done-sync'),
  statsOverlay: $('stats-overlay'),
}

const counter = createCounter()
let verse = cachedVerse()

// ---------- 날짜 ----------
function renderDate() {
  const today = new Date()
  els.date.innerText =
    `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`
}

// ---------- 헤더 배지: 칭호 · 레벨 · 연속 ----------
// 레벨은 하루핑 XP와 합산 (로그인 시 서버에서 하루핑 XP를 받아온다)
function combinedXpState() {
  return xpStateFromTotal(haggadahXp(counter.stats()) + sync.getHarupingXp())
}

function renderBadge() {
  const s = counter.stats()
  const streak = currentStreak(s.counts)
  const parts = []
  const title = streakTitle(streak)
  if (title) parts.push(title)
  // 레벨은 서버 응답(하루핑 XP) 도착 후에만 표시 — 값이 바뀌어 보이는 혼란 방지
  if (sync.isXpReady()) {
    const xp = combinedXpState()
    if (xp.total > 0) parts.push(`${levelBadge(xp.level)} Lv.${xp.level}`)
  }
  if (streak >= 1) parts.push(`🔥 ${streak}일 연속`)
  els.badge.innerText = parts.length ? parts.join(' · ') : '🙏 오늘 첫 100회에 도전해요'
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

// ---------- 카운터 + 진행바 ----------
function renderCount(n) {
  els.counter.innerText = n
  els.goalFill.style.width = `${Math.min(n / GOAL, 1) * 100}%`
  els.goalText.innerText = `${n} / ${GOAL}`
  els.goalProgress.classList.toggle('goal-done', n >= GOAL)
  renderBadge()
}

renderCount(counter.get())

// 자정 넘김: 다시 화면에 보일 때 오늘 날짜/카운트로 갱신
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    renderDate()
    renderCount(counter.get())
  }
})

// ---------- 토스트 ----------
let toastTimer = null
function showToast(message, ms = 2200) {
  els.toast.innerText = message
  els.toast.hidden = false
  els.toast.classList.remove('toast-in')
  void els.toast.offsetWidth // 애니메이션 재시작
  els.toast.classList.add('toast-in')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { els.toast.hidden = true }, ms)
}

// ---------- 100회 완료 카드 ----------
function showDoneCard() {
  const s = counter.stats()
  const streak = currentStreak(s.counts)
  const xp = combinedXpState()
  const stage = treeStage(s.achievedDays)
  const prevStage = treeStage(Math.max(0, s.achievedDays - 1))
  const next = nextStreakTitle(streak)

  $('done-streak').innerText = `🔥 ${streak}일 연속 달성!`
  $('done-tree').innerText = prevStage.emoji !== stage.emoji
    ? `${prevStage.emoji} → ${stage.emoji}  말씀의 나무가 자랐어요!`
    : `${stage.emoji} 말씀의 나무가 자라는 중 (${s.achievedDays}일째)`
  $('done-total').innerText =
    `지금까지 ${s.total.toLocaleString()}번 읊조렸습니다`
    + (sync.isXpReady()
      ? ` · ${levelBadge(xp.level)} Lv.${xp.level} (다음 레벨까지 ${(xp.xpNeed - xp.xpInto).toLocaleString()} XP)`
      : '')
  $('done-month').innerText =
    `✅ 이번 달 ${monthlyAchieved(s.counts)}일 달성 · 🏆 최고 연속 ${s.bestStreak}일`

  const lines = [`🔥 내일 달성하면 ${streak + 1}일 연속`]
  if (next) {
    lines.push(next.remain === 1
      ? `내일이면 『${next.name}』 달성!`
      : `『${next.name}』까지 ${next.remain}일`)
  }
  $('done-tomorrow').innerText = lines.join('\n')

  els.doneOverlay.hidden = false
}

els.btnDoneClose.addEventListener('click', () => {
  els.doneOverlay.hidden = true
})

// ---------- +1 ----------
els.btnIncrease.addEventListener('click', () => {
  const prev = counter.get()
  const n = counter.increment()
  navigator.vibrate?.(10)
  renderCount(n)

  if (prev < GOAL && n >= GOAL) {
    // 오늘의 100회 달성: 대형 효과를 잠깐 보여준 뒤 완료 카드
    celebrateGrand()
    setTimeout(showDoneCard, 1000)
    sync.flushPush() // 달성 순간은 바로 저장
  } else {
    if (n % 100 === 0) {
      celebrateGrand()
    } else if (n % 10 === 0) {
      celebrateMinor()
      const msg = MILESTONE_MSGS[n]
      if (msg) showToast(msg)
    }
    sync.schedulePush()
  }
})

els.btnReset.addEventListener('click', () => {
  renderCount(counter.reset())
  sync.schedulePush()
})

// ---------- 상황판: 나의 말씀 여정 ----------
function renderStats() {
  const s = counter.stats()
  const streak = currentStreak(s.counts)
  const xp = combinedXpState()
  const stage = treeStage(s.achievedDays)
  const next = nextStreakTitle(streak)

  $('st-tree-emoji').innerText = stage.emoji
  $('st-tree-label').innerText = s.achievedDays > 0
    ? `말씀의 나무 — ${stage.name} (${s.achievedDays}일 달성)`
    : '말씀의 나무 — 씨앗 (첫 100회를 기다려요)'

  const title = streakTitle(streak)
  const titleParts = []
  if (title) titleParts.push(title)
  if (next) titleParts.push(`다음 칭호 『${next.name}』까지 ${next.remain}일`)
  $('st-title').innerText = titleParts.join(' · ') || '오늘 100회를 달성하면 여정이 시작돼요'

  $('st-streak').innerText = `🔥 ${streak}일`
  $('st-best').innerText = `🏆 ${s.bestStreak}일`
  $('st-month').innerText = `✅ ${monthlyAchieved(s.counts)}일`
  $('st-total').innerText = s.total.toLocaleString()

  if (sync.isXpReady()) {
    $('st-level').innerText =
      `${levelBadge(xp.level)} Lv.${xp.level} · ${xp.total.toLocaleString()} XP`
      + (sync.isLoggedIn() ? ' (하루핑 합산)' : '')
    $('st-level-remain').innerText = `Lv.${xp.level + 1}까지 ${(xp.xpNeed - xp.xpInto).toLocaleString()} XP`
    $('st-level-fill').style.width = `${Math.round((xp.xpInto / xp.xpNeed) * 100)}%`
  } else {
    $('st-level').innerText = '⏳ 레벨 불러오는 중'
    $('st-level-remain').innerText = ''
    $('st-level-fill').style.width = '0%'
  }

  $('st-today').innerText = `${counter.get()} / ${GOAL}`

  // 카카오 동기화 섹션
  const section = $('st-sync-section')
  section.hidden = !sync.SYNC_ENABLED
  if (sync.SYNC_ENABLED) {
    const on = sync.isLoggedIn()
    const name = sync.getNickname()
    $('st-sync-msg').innerText = on
      ? `☁️ ${name ? `${name}님, ` : ''}카카오 연결됨 — 기록이 자동 저장되고 하루핑과 XP가 합산돼요`
      : '지금 기록은 이 기기에만 저장되고 있어요.\n카카오로 로그인하면 안전하게 보관되고, 하루핑과 XP·레벨이 합산돼요.'
    $('btn-stats-kakao').hidden = on
    $('btn-stats-nickname').hidden = !on
    $('btn-stats-logout').hidden = !on
  }
}

function openStats() {
  renderStats()
  els.statsOverlay.hidden = false
}

els.btnStats.addEventListener('click', openStats)
els.badge.addEventListener('click', openStats)
$('btn-stats-close').addEventListener('click', () => { els.statsOverlay.hidden = true })
$('btn-stats-kakao').addEventListener('click', () => sync.login())
$('btn-stats-nickname').addEventListener('click', async () => {
  const name = prompt('새 닉네임을 입력하세요 (1~16자)\n하루핑에도 함께 적용됩니다.', sync.getNickname() || '')
  if (name === null) return
  const result = await sync.changeNickname(name)
  if (result.ok) {
    showToast(`닉네임을 '${result.nickname}'(으)로 변경했어요`)
    renderStats()
  } else {
    showToast(result.error)
  }
})

$('btn-stats-logout').addEventListener('click', () => {
  if (confirm('카카오 연결을 해제할까요?\n(기록은 이 기기와 서버에 그대로 남습니다)')) {
    sync.logout()
    showToast('카카오 연결을 해제했어요')
    renderStats()
  }
})

// ---------- 카카오 동기화 ----------
function renderSyncUI() {
  const on = sync.isLoggedIn()
  els.btnStats.classList.toggle('sync-on', sync.SYNC_ENABLED && on)
  els.btnDoneSync.hidden = !sync.SYNC_ENABLED || on
  if (!els.statsOverlay.hidden) renderStats()
}

renderSyncUI()
sync.initSync({
  counter,
  onChange: () => renderCount(counter.get()), // 서버 기록 병합 후 화면 갱신
  onUser: (user, justLoggedIn) => {
    renderSyncUI()
    renderCount(counter.get()) // 하루핑 XP 반영해 배지(합산 레벨) 갱신
    if (user && justLoggedIn) showToast('☁️ 카카오 연결됨 — 기록이 안전하게 저장돼요')
  },
  onLoginError: () => showToast('카카오 로그인에 실패했어요. 다시 시도해 주세요'),
})

els.btnDoneSync.addEventListener('click', () => sync.login())

// 로그인 안내: 기기당 1회, 접속 2초 후 살짝 보여준다
if (sync.SYNC_ENABLED && !localStorage.getItem('haggadah.kakaoNudge')) {
  setTimeout(() => {
    if (!sync.isLoggedIn()) {
      showToast('📊 왼쪽 위 버튼에서 내 여정 확인 + 카카오로 기록을 지킬 수 있어요', 3500)
      try { localStorage.setItem('haggadah.kakaoNudge', '1') } catch { /* 무시 */ }
    }
  }, 2000)
}

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
