// 화면 꺼짐 방지 (Wake Lock API). HTTPS 또는 localhost에서만 동작.
export const supported = 'wakeLock' in navigator

let sentinel = null

export async function enable() {
  if (!supported) return false
  try {
    sentinel = await navigator.wakeLock.request('screen')
    sentinel.addEventListener('release', () => { sentinel = null })
    return true
  } catch {
    return false
  }
}

export function disable() {
  sentinel?.release()
  sentinel = null
}

// 탭 전환/화면 잠금 후 다시 보일 때 자동 재획득
export function reacquireOnVisible(shouldBeOn) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && shouldBeOn() && !sentinel) enable()
  })
}
