import * as sync from './sync.js'

const $ = (id) => document.getElementById(id)
let requestId = 0

function rankingRow(entry) {
  const row = document.createElement('li')
  row.className = `leaderboard-row${entry.isMe ? ' is-me' : ''}`
  const rank = document.createElement('span')
  rank.className = 'leaderboard-rank'
  rank.textContent = `${entry.rank}위`
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
    const res = await fetch('/api/leaderboard', { cache: 'no-store', signal: controller.signal })
    if (!res.ok) throw new Error('조회 실패')
    const data = await res.json()
    if (id !== requestId) return
    $('leaderboard-summary').textContent = `${data.participants.toLocaleString()}명 참여 · 상위 50명`
    status.textContent = data.entries.length ? '' : '아직 등록된 기록이 없어요. 첫 번째 여정을 시작해 보세요!'
    list.replaceChildren(...data.entries.map(rankingRow))
    if (data.myEntry) {
      const mine = $('leaderboard-mine')
      mine.textContent = `내 순위 ${data.myEntry.rank}위 · ${data.myEntry.total.toLocaleString()}회`
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
  const close = () => {
    overlay.hidden = true
    $('stats-overlay').inert = false
    ++requestId
    $('btn-leaderboard').focus()
  }
  $('btn-leaderboard').addEventListener('click', () => {
    $('stats-overlay').inert = true
    overlay.hidden = false
    $('btn-leaderboard-close').focus()
    loadRanking()
  })
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
