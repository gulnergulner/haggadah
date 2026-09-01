// 카카오 로그인 세션 — HMAC 서명 쿠키 (하루핑과 동일한 형식/시크릿을 공유).
// 토큰 형식: "<uid>.<만료 epoch초>.<서명>"  (uid는 카카오 숫자 id)
// 쿠키를 .godagent.net 도메인으로 설정해 하루핑과 로그인이 공유된다.
import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'hp_session'
const MAX_AGE_SEC = 60 * 60 * 24 * 90 // 90일

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) throw new Error('SESSION_SECRET이 설정되지 않았습니다 (16자 이상).')
  return s
}

function sign(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createSessionToken(uid) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC
  const payload = `${uid}.${exp}`
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token) {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [uid, expStr, sig] = parts
  const expected = sign(`${uid}.${expStr}`)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (Number(expStr) < Math.floor(Date.now() / 1000)) return null
  return uid
}

export function parseCookies(req) {
  const out = {}
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

export function getSessionUid(req) {
  const token = parseCookies(req)[SESSION_COOKIE]
  return token ? verifySessionToken(token) : null
}

// godagent.net 계열에서만 부모 도메인 쿠키(하루핑과 공유), 그 외(vercel.app 등)는 호스트 쿠키
function domainAttr(host) {
  return host && host.endsWith('godagent.net') ? '; Domain=.godagent.net' : ''
}

export function sessionCookie(token, host) {
  return `${SESSION_COOKIE}=${token}${domainAttr(host)}; Path=/; Max-Age=${MAX_AGE_SEC}; HttpOnly; Secure; SameSite=Lax`
}

export function clearSessionCookie(host) {
  return `${SESSION_COOKIE}=${domainAttr(host)}; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
}

export function requestHost(req) {
  return req.headers['x-forwarded-host'] || req.headers.host || ''
}

export function baseUrl(req) {
  return `https://${requestHost(req)}`
}
