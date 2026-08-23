import { loadState, saveState, todayKey, pruneOldCounts } from './storage.js'

// 카운트 상태 머신. 날짜 키를 매 조작 직전에 재계산해서
// 화면을 켜둔 채 자정을 넘겨도 새 날은 0부터 시작한다.
export function createCounter() {
  const state = loadState()
  pruneOldCounts(state)
  saveState(state)

  function get() {
    return state.counts[todayKey()] || 0
  }

  function set(n) {
    state.counts[todayKey()] = n
    saveState(state)
  }

  return {
    get,
    increment() { const n = get() + 1; set(n); return n },
    decrement() { const n = Math.max(0, get() - 1); set(n); return n },
    reset() { set(0); return 0 },
    getPref(key) { return state[key] },
    setPref(key, value) { state[key] = value; saveState(state) },
  }
}
