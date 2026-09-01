import { loadState, saveState, todayKey, pruneOldCounts } from './storage.js'
import { GOAL, currentStreak, maxStreak } from './journey.js'

// 카운트 상태 머신. 날짜 키를 매 조작 직전에 재계산해서
// 화면을 켜둔 채 자정을 넘겨도 새 날은 0부터 시작한다.
// 일자별 counts 외에 여정 통계(누적 total, 달성 일수, 최고 연속)를 함께 유지한다.
export function createCounter() {
  const state = loadState()
  pruneOldCounts(state)

  // 여정 통계 마이그레이션: 기존 사용자는 저장된 counts 이력에서 초기값을 계산
  if (typeof state.total !== 'number') {
    const values = Object.values(state.counts)
    state.total = values.reduce((sum, n) => sum + n, 0)
    state.achievedDays = values.filter((n) => n >= GOAL).length
    state.bestStreak = maxStreak(state.counts)
  }
  saveState(state)

  function get() {
    return state.counts[todayKey()] || 0
  }

  function set(n) {
    const today = todayKey()
    const prev = state.counts[today] || 0
    state.total = Math.max(0, state.total + (n - prev))
    if (prev < GOAL && n >= GOAL) {
      state.achievedDays += 1
      const streak = currentStreak({ ...state.counts, [today]: n }, today)
      if (streak > state.bestStreak) state.bestStreak = streak
    } else if (prev >= GOAL && n < GOAL) {
      // 리셋/감소로 달성이 취소된 경우
      state.achievedDays = Math.max(0, state.achievedDays - 1)
    }
    state.counts[today] = n
    saveState(state)
  }

  return {
    get,
    increment() { const n = get() + 1; set(n); return n },
    decrement() { const n = Math.max(0, get() - 1); set(n); return n },
    reset() { set(0); return 0 },
    getPref(key) { return state[key] },
    setPref(key, value) { state[key] = value; saveState(state) },
    stats() {
      return {
        total: state.total,
        achievedDays: state.achievedDays,
        bestStreak: state.bestStreak,
        counts: state.counts,
      }
    },
    // 동기화용: 서버에 저장할 스냅샷
    exportState() {
      return {
        counts: { ...state.counts },
        total: state.total,
        achievedDays: state.achievedDays,
        bestStreak: state.bestStreak,
      }
    },
    // 동기화용: 서버 기록과 병합. 일자별로 큰 값을 채택하고
    // 누적 통계는 양쪽 중 큰 값을 취한다. 변경이 있었으면 true.
    mergeRemote(remote) {
      if (!remote) return false
      let changed = false
      for (const [day, n] of Object.entries(remote.counts || {})) {
        if (typeof n === 'number' && (state.counts[day] || 0) < n) {
          state.counts[day] = n
          changed = true
        }
      }
      for (const key of ['total', 'achievedDays', 'bestStreak']) {
        const v = remote[key]
        if (typeof v === 'number' && v > state[key]) {
          state[key] = v
          changed = true
        }
      }
      const streakFloor = maxStreak(state.counts) // 병합된 이력이 만든 새 연속 기록 반영
      if (streakFloor > state.bestStreak) {
        state.bestStreak = streakFloor
        changed = true
      }
      if (changed) {
        pruneOldCounts(state)
        saveState(state)
      }
      return changed
    },
  }
}
