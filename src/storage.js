const STATE_KEY = 'haggadah.v1'
const CACHE_KEY = 'haggadah.verseCache'

// 기기 로컬 날짜 기준 YYYY-MM-DD (UTC ISO slice 사용 금지 — KST 자정 기준이어야 함)
export function todayKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DEFAULTS = { lang: 'ko', wakeLock: false, counts: {} }

export function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULTS, ...parsed, counts: parsed.counts || {} }
    }
  } catch { /* 손상된 데이터는 초기화 */ }
  return { ...DEFAULTS }
}

export function saveState(state) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)) } catch { /* 저장 공간 부족 등 무시 */ }
}

export function pruneOldCounts(state, days = 400) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffKey = todayKey(cutoff)
  for (const k of Object.keys(state.counts)) {
    if (k < cutoffKey) delete state.counts[k]
  }
}

export function loadVerseCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) } catch { return null }
}

export function saveVerseCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch { /* 무시 */ }
}
