// 카카오 인가 콜백: code → 토큰 → 사용자 id → 세션 쿠키 (하루핑과 동일 흐름).
import {
  baseUrl, requestHost, createSessionToken, sessionCookie, parseCookies,
} from '../../_lib/auth.js'
import { upsertUser } from '../../_lib/db.js'

// 카카오 닉네임 미제공 시 부여하는 성경 인물 랜덤 닉네임 (하루핑과 동일 목록)
const BIBLE_NAMES = [
  '아담', '노아', '아브라함', '사라', '이삭', '리브가', '야곱', '라헬',
  '요셉', '모세', '미리암', '여호수아', '갈렙', '드보라', '기드온', '룻',
  '한나', '사무엘', '다윗', '요나단', '솔로몬', '엘리야', '엘리사',
  '이사야', '예레미야', '에스겔', '다니엘', '호세아', '요나', '에스더',
  '느헤미야', '에스라', '마리아', '요한', '베드로', '안드레', '야고보',
  '마태', '누가', '마가', '바울', '바나바', '디모데', '디도', '실라',
  '브리스길라', '아굴라', '루디아', '도르가', '스데반',
]

export default async function handler(req, res) {
  const base = baseUrl(req)
  const fail = (reason) => res.redirect(302, `${base}/?login=failed&reason=${reason}`)

  const { code, state } = req.query
  const savedState = parseCookies(req).hg_oauth_state
  if (!code || !state || !savedState || state !== savedState) return fail('state')

  const clientId = process.env.KAKAO_REST_API_KEY
  if (!clientId) return fail('config')

  try {
    // 토큰 교환
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: `${base}/api/auth/kakao/callback`,
      code,
    })
    if (process.env.KAKAO_CLIENT_SECRET) {
      body.set('client_secret', process.env.KAKAO_CLIENT_SECRET)
    }
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!tokenRes.ok) return fail('token')
    const token = await tokenRes.json()
    if (!token.access_token) return fail('token')

    // 사용자 정보 (동의항목 없이도 id는 항상 온다)
    const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
    if (!meRes.ok) return fail('me')
    const me = await meRes.json()
    if (!me.id) return fail('me')

    const nickname =
      me.kakao_account?.profile?.nickname ??
      me.properties?.nickname ??
      BIBLE_NAMES[Math.floor(Math.random() * BIBLE_NAMES.length)]

    await upsertUser(String(me.id), nickname)

    res.setHeader('Set-Cookie', [
      sessionCookie(createSessionToken(String(me.id)), requestHost(req)),
      'hg_oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
    ])
    res.redirect(302, `${base}/?login=ok`)
  } catch (err) {
    console.error('kakao callback 오류:', err)
    return fail('db')
  }
}
