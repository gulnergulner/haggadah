// 카카오 로그인 시작: CSRF state 쿠키를 심고 카카오 인가 페이지로 리다이렉트.
// scope를 지정하지 않으므로 카카오 앱에 설정된 동의항목만 요청된다
// (동의항목이 없어도 로그인 가능 — 비즈 앱 전환 불필요).
import { randomBytes } from 'node:crypto'
import { baseUrl } from '../../_lib/auth.js'

export default function handler(req, res) {
  const clientId = process.env.KAKAO_REST_API_KEY
  if (!clientId) {
    res.status(503).json({ error: 'not configured: set KAKAO_REST_API_KEY' })
    return
  }
  const state = randomBytes(16).toString('hex')
  res.setHeader('Set-Cookie',
    `hg_oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${baseUrl(req)}/api/auth/kakao/callback`,
    response_type: 'code',
    state,
  })
  res.redirect(302, `https://kauth.kakao.com/oauth/authorize?${params}`)
}
