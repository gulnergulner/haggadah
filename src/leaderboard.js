import { createElement, ListOrdered } from 'lucide'
import * as sync from './sync.js'

const $ = (id) => document.getElementById(id)
let requestId = 0

function trophyIcon(position) {
  const svgNS = 'http://www.w3.org/2000/svg'
  const trophy = document.createElementNS(svgNS, 'svg')
  trophy.setAttribute('class', `rank-trophy place-${position}`)
  trophy.setAttribute('aria-hidden', 'true')
  const cup = document.createElementNS(svgNS, 'use')
  cup.setAttribute('href', '#podium-cup')
  trophy.append(cup)
  return trophy
}

function updateShortcut(rank) {
  const button = $('btn-ranking-shortcut')
  const awarded = sync.isLoggedIn() && rank >= 1 && rank <= 3
  button.replaceChildren(awarded ? trophyIcon(rank) : createElement(ListOrdered, { width: 20, height: 20, 'aria-hidden': 'true' }))
  button.title = awarded ? `랭킹 보기 · 내 순위 ${rank}위` : '랭킹 보기'
  button.setAttribute('aria-label', button.title)
}

async function fetchRanking(signal) {
  const res = await fetch('/api/leaderboard', { cache: 'no-store', signal })
  if (!res.ok) throw new Error('조회 실패')
  return res.json()
}

let trophyCacheKey = null

export function restoreRankingShortcut(cacheId) {
  trophyCacheKey = cacheId ? `haggadah.trophy.${cacheId}` : null
  let rank = null
  try {
    if (trophyCacheKey) rank = Number(localStorage.getItem(trophyCacheKey))
  } catch { /* 저장소를 사용할 수 없으면 기본 아이콘 표시 */ }
  updateShortcut(rank)
}

function rememberRankingShortcut(rank) {
  updateShortcut(rank)
  if (!trophyCacheKey) return
  try {
    if ([1, 2, 3].includes(rank)) localStorage.setItem(trophyCacheKey, String(rank))
    else localStorage.removeItem(trophyCacheKey)
  } catch { /* 저장할 수 없어도 현재 순위는 표시 */ }
}

function rankLabel(position) {
  const label = document.createElement('span')
  label.className = 'rank-label'
  const number = document.createElement('span')
  number.className = 'rank-number'
  number.textContent = `${position}위`
  label.append(number)
  if (position >= 1 && position <= 3) {
    label.prepend(trophyIcon(position))
  }
  return label
}

function rankingRow(entry) {
  const row = document.createElement('li')
  row.className = `leaderboard-row${entry.isMe ? ' is-me' : ''}`
  const rank = rankLabel(entry.rank)
  rank.classList.add('leaderboard-rank')
  const name = document.createElement('span')
  name.className = 'leaderboard-name'
  name.textContent = `${entry.nickname}${entry.isMe ? ' (나)' : ''}`
  const total = document.createElement('strong')
  total.textContent = `${entry.total.toLocaleString()}회`
  row.append(rank, name, total)
  return row
}

async function loadRanking() {
  const id = ++requestId
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  const list = $('leaderboard-list')
  const status = $('leaderboard-status')
  const refresh = $('btn-leaderboard-refresh')
  refresh.disabled = true
  list.setAttribute('aria-busy', 'true')
  list.replaceChildren()
  $('leaderboard-mine').hidden = true
  $('leaderboard-summary').textContent = ''
  status.textContent = '랭킹을 불러오는 중입니다.'
  $('btn-leaderboard-login').hidden = sync.isLoggedIn()
  try {
    if (sync.isLoggedIn()) await sync.flushPush({ signal: controller.signal })
    if (controller.signal.aborted) throw new Error('timeout')
    const data = await fetchRanking(controller.signal)
    if (id !== requestId) return
    rememberRankingShortcut(data.myEntry?.rank)
    $('leaderboard-summary').textContent = `${data.participants.toLocaleString()}명 참여 · 상위 50명`
    status.textContent = data.entries.length ? '' : '아직 등록된 기록이 없어요. 첫 번째 여정을 시작해 보세요!'
    list.replaceChildren(...data.entries.map(rankingRow))
    if (data.myEntry) {
      const mine = $('leaderboard-mine')
      mine.replaceChildren('내 순위 ', rankLabel(data.myEntry.rank), ` · ${data.myEntry.total.toLocaleString()}회`)
      mine.hidden = false
    } else if (sync.isLoggedIn()) {
      status.textContent = '읊조림 기록을 저장하면 랭킹에 참여할 수 있어요.'
    }
  } catch {
    if (id !== requestId) return
    status.textContent = '랭킹을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    clearTimeout(timer)
    if (id === requestId) {
      refresh.disabled = false
      list.setAttribute('aria-busy', 'false')
    }
  }
}

export function initLeaderboard() {
  const overlay = $('leaderboard-overlay')
  let opener
  updateShortcut()
  const close = () => {
    overlay.hidden = true
    $('stats-overlay').inert = false
    ++requestId
    opener.focus()
  }
  const open = (event) => {
    opener = event.currentTarget
    $('stats-overlay').inert = true
    overlay.hidden = false
    $('btn-leaderboard-dismiss').focus()
    loadRanking()
  }
  $('btn-leaderboard').addEventListener('click', open)
  $('btn-ranking-shortcut').addEventListener('click', open)
  $('btn-leaderboard-dismiss').addEventListener('click', close)
  $('btn-leaderboard-close').addEventListener('click', close)
  $('btn-leaderboard-refresh').addEventListener('click', loadRanking)
  $('btn-leaderboard-login').addEventListener('click', () => sync.login())
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close() })
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close()
    if (event.key !== 'Tab') return
    const buttons = [...overlay.querySelectorAll('button')].filter((button) => !button.hidden && !button.disabled)
    const first = buttons[0]
    const last = buttons.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  })
}
