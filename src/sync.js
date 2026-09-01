// 카카오 로그인 + Supabase 개인 기록 동기화.
// Supabase Auth가 카카오 OAuth를 기본 제공하므로 별도 서버/함수가 필요 없다.
//
// 동기화: 로컬(localStorage)이 항상 기준이고, 서버는 백업/기기 간 동기화 계층이다.
// - 로그인 시: 서버 기록을 읽어 로컬과 병합(일자별 큰 값 채택) 후 서버에 반영
// - 이후: 조작이 멈춘 뒤 3초 / 화면 이탈 시에만 행 1개를 통째로 저장 (무료 한도 보호)
import { supabase, isConfigured } from './supabase.js'

// Supabase 대시보드에서 카카오 공급자 설정이 끝나면 true로 변경.
// false면 동기화 UI가 전혀 표시되지 않고 기존과 동일하게 동작한다.
export const SYNC_ENABLED = true

const PUSH_DELAY_MS = 3000

let user = null
let counter = null
let onChange = null
let pushTimer = null

export function isLoggedIn() {
  return !!user
}

export function initSync(opts) {
  if (!SYNC_ENABLED || !isConfigured) return
  counter = opts.counter
  onChange = opts.onChange

  // 세션 복원 + 카카오 리다이렉트 복귀 처리 (supabase-js가 URL의 인가 코드를 자동 교환)
  supabase.auth.onAuthStateChange((_event, session) => {
    const next = session?.user || null
    const wasLoggedIn = !!user
    user = next
    opts.onUser?.(next)
    if (next && !wasLoggedIn) pullAndMerge()
  })

  // 화면을 벗어날 때 저장 대기분을 즉시 반영
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPush()
  })
}

export function login() {
  if (!supabase) return
  supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: `${location.origin}/` },
  })
}

export function logout() {
  supabase?.auth.signOut()
}

async function pullAndMerge() {
  try {
    const { data, error } = await supabase
      .from('user_records')
      .select('counts, total, achieved_days, best_streak')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw error
    const remote = data
      ? {
          counts: data.counts,
          total: data.total,
          achievedDays: data.achieved_days,
          bestStreak: data.best_streak,
        }
      : null
    const changed = counter.mergeRemote(remote)
    if (changed) onChange?.()
    flushPush() // 병합 결과(또는 첫 백업)를 서버에 기록
  } catch (err) {
    console.error('동기화 읽기 실패:', err)
  }
}

// 조작이 멈춘 뒤 PUSH_DELAY_MS 후 저장 (연타 중에는 쓰기 없음)
export function schedulePush() {
  if (!user) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(flushPush, PUSH_DELAY_MS)
}

export async function flushPush() {
  if (!user) return
  clearTimeout(pushTimer)
  pushTimer = null
  try {
    const s = counter.exportState()
    const { error } = await supabase.from('user_records').upsert({
      user_id: user.id,
      counts: s.counts,
      total: s.total,
      achieved_days: s.achievedDays,
      best_streak: s.bestStreak,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
  } catch (err) {
    console.error('동기화 저장 실패:', err)
  }
}
