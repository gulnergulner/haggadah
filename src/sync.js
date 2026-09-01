// 카카오 로그인 + 하루핑 공유 DB 동기화.
// 로그인: 하루핑과 동일한 자체 카카오 OAuth(/api/auth/kakao) + HMAC 세션 쿠키.
//   쿠키가 .godagent.net 공유라서 하가다에서 로그인하면 하루핑에도 적용된다.
// 저장: 하루핑과 같은 HarupingUser 행의 haggadah 컬럼 (카카오 ID가 공통 키).
//
// 동기화: 로컬(localStorage)이 항상 기준이고, 서버는 백업/기기 간 동기화 계층이다.
// - 접속 시: 세션이 있으면 서버 기록을 읽어 로컬과 병합(일자별 큰 값 채택) 후 반영
// - 이후: 조작이 멈춘 뒤 3초 / 화면 이탈 시에만 저장

export const SYNC_ENABLED = true

const PUSH_DELAY_MS = 3000

let loggedIn = false
let nickname = null
let harupingXp = 0
let counter = null
let onChange = null
let pushTimer = null

export function isLoggedIn() {
  return loggedIn
}

/** 하루핑에서 쌓은 XP (합산 레벨 계산용, 비로그인 시 0) */
export function getHarupingXp() {
  return harupingXp
}

export function getNickname() {
  return nickname
}

export function initSync(opts) {
  if (!SYNC_ENABLED) return
  counter = opts.counter
  onChange = opts.onChange

  // 카카오 로그인에서 돌아온 경우 URL 정리 + 실패 안내
  const params = new URLSearchParams(location.search)
  if (params.has('login')) {
    const failed = params.get('login') === 'failed'
    history.replaceState(null, '', location.pathname)
    if (failed) opts.onLoginError?.()
  }

  // 세션 확인 → 로그인 상태면 서버 기록 병합
  fetch('/api/me', { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : { loggedIn: false }))
    .then((me) => {
      loggedIn = !!me.loggedIn
      nickname = me.nickname ?? null
      harupingXp = typeof me.harupingXp === 'number' ? me.harupingXp : 0
      opts.onUser?.(loggedIn)
      if (loggedIn) {
        const changed = counter.mergeRemote(me.haggadah || null)
        if (changed) onChange?.()
        flushPush() // 병합 결과(또는 첫 백업)를 서버에 기록
      }
    })
    .catch(() => { /* 오프라인/로컬 개발 등 — 비로그인으로 동작 */ })

  // 화면을 벗어날 때 저장 대기분을 즉시 반영
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPush()
  })
}

export function login() {
  location.href = '/api/auth/kakao'
}

/** 닉네임 변경 (하루핑과 공유되는 닉네임) */
export async function changeNickname(name) {
  try {
    const res = await fetch('/api/nickname', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: name }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.ok) {
      nickname = data.nickname
      return { ok: true, nickname: data.nickname }
    }
    return { ok: false, error: data.error || '닉네임 변경에 실패했어요' }
  } catch {
    return { ok: false, error: '네트워크 오류가 발생했어요' }
  }
}

export async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* 무시 */ }
  loggedIn = false
  nickname = null
  harupingXp = 0
}

// 조작이 멈춘 뒤 PUSH_DELAY_MS 후 저장 (연타 중에는 쓰기 없음)
export function schedulePush() {
  if (!loggedIn) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(flushPush, PUSH_DELAY_MS)
}

export async function flushPush() {
  if (!loggedIn) return
  clearTimeout(pushTimer)
  pushTimer = null
  try {
    await fetch('/api/haggadah-state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(counter.exportState()),
    })
  } catch (err) {
    console.error('동기화 저장 실패:', err)
  }
}
