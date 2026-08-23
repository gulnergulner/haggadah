const MILESTONES = [25, 50, 75, 100]

const MESSAGES = {
  25: '좋은 출발이에요! 25번 💪',
  50: '절반 왔어요! 🔥',
  75: '조금만 더! 75번 ✨',
  100: '오늘의 하가다 완료! 🎉',
}

// canvas-confetti는 첫 마일스톤 때 지연 로드 (초기 번들 0바이트)
let confettiPromise = null
function getConfetti() {
  confettiPromise ||= import('canvas-confetti').then((m) => m.default)
  return confettiPromise
}

// prev < m && next >= m 전환일 때만 발동 → 새로고침해도 재발동 없음
export function checkMilestone(prev, next) {
  return MILESTONES.find((m) => prev < m && next >= m) || null
}

export async function celebrate(milestone) {
  showToast(MESSAGES[milestone])
  try {
    const confetti = await getConfetti()
    if (milestone === 100) {
      confetti({ particleCount: 120, spread: 100, origin: { y: 0.6 } })
      setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } }), 250)
      setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } }), 500)
    } else {
      confetti({ particleCount: 40 + milestone, spread: 75, origin: { y: 0.72 } })
    }
  } catch { /* 오프라인 등으로 로드 실패 시 토스트만 표시 */ }
}

let toastTimer = null
export function showToast(message, ms = 2200) {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = message
  el.hidden = false
  el.classList.remove('toast-in')
  void el.offsetWidth // 애니메이션 재시작
  el.classList.add('toast-in')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { el.hidden = true }, ms)
}
