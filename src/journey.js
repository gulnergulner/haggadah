// "말씀을 매일 이어가는 여정" 계산 모듈.
// 연속 달성(스트릭), 월간/최고 기록, 누적 레벨, 연속 칭호, 말씀의 나무 단계.
// 모든 계산은 counter의 일자별 counts 이력과 누적 통계에서 파생된다.
import { todayKey } from './storage.js'

export const GOAL = 100

const DAY_MS = 24 * 60 * 60 * 1000

// 'YYYY-MM-DD'의 전날 키 (정오 기준으로 계산해 DST/시간대 경계 오차 방지)
function prevDayKey(key) {
  const d = new Date(`${key}T12:00:00`)
  return todayKey(new Date(d.getTime() - DAY_MS))
}

// 현재 연속 달성 일수. 오늘 미달성이면 어제까지 이어진 연속을 반환해서
// 하루가 끝나기 전에는 "진행 중인 연속"으로 보여준다.
export function currentStreak(counts, today = todayKey()) {
  let day = today
  if ((counts[day] || 0) < GOAL) day = prevDayKey(day)
  let streak = 0
  while ((counts[day] || 0) >= GOAL) {
    streak++
    day = prevDayKey(day)
  }
  return streak
}

// 이력 전체에서의 최장 연속 기록
export function maxStreak(counts) {
  const days = Object.keys(counts).filter((k) => counts[k] >= GOAL).sort()
  let best = 0
  let run = 0
  let prev = null
  for (const d of days) {
    run = prev !== null && prevDayKey(d) === prev ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }
  return best
}

// 이번 달 100회 달성 일수
export function monthlyAchieved(counts, today = todayKey()) {
  const month = today.slice(0, 7)
  return Object.keys(counts).filter((k) => k.startsWith(month) && counts[k] >= GOAL).length
}

// 누적 레벨: Lv.n 도달 기준 = 50·n·(n+1)회 → 100, 300, 600, 1000, 1500, ...
export function levelInfo(total) {
  let level = 0
  while (total >= 50 * (level + 1) * (level + 2)) level++
  const base = 50 * level * (level + 1) // 현재 레벨 시작점
  const next = 50 * (level + 1) * (level + 2)
  return {
    level,
    next,
    remain: next - total,
    progress: (total - base) / (next - base), // 0~1, 다음 레벨까지의 진행률
  }
}

// 연속 달성 일수에 따른 칭호 (긴 기간 우선)
export const STREAK_TITLES = [
  { days: 100, name: '🏆 하가다 마스터' },
  { days: 50, name: '💎 말씀을 품은 자' },
  { days: 30, name: '🌳 말씀의 나무' },
  { days: 14, name: '📖 말씀을 가까이하는 자' },
  { days: 7, name: '🔥 말씀 지킴이' },
  { days: 3, name: '🌿 말씀의 새싹' },
  { days: 1, name: '🌱 첫걸음' },
]

export function streakTitle(streak) {
  const t = STREAK_TITLES.find((t) => streak >= t.days)
  return t ? t.name : null
}

// 다음 칭호와 남은 일수
export function nextStreakTitle(streak) {
  const next = [...STREAK_TITLES].reverse().find((t) => t.days > streak)
  return next ? { ...next, remain: next.days - streak } : null
}

// 말씀의 나무: 지금까지 100회를 달성한 총 일수에 따라 성장
export const TREE_STAGES = [
  { min: 30, emoji: '🍎', name: '열매' },
  { min: 21, emoji: '🌸', name: '꽃' },
  { min: 14, emoji: '🌳', name: '나무' },
  { min: 7, emoji: '🪴', name: '잎' },
  { min: 3, emoji: '🌿', name: '줄기' },
  { min: 1, emoji: '🌱', name: '새싹' },
  { min: 0, emoji: '🌰', name: '씨앗' },
]

export function treeStage(achievedDays) {
  return TREE_STAGES.find((s) => achievedDays >= s.min)
}
