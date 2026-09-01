// 로그아웃: 세션 쿠키 삭제 (godagent.net 공유 쿠키 포함)
import { clearSessionCookie, requestHost } from '../_lib/auth.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }
  res.setHeader('Set-Cookie', clearSessionCookie(requestHost(req)))
  res.status(200).json({ ok: true })
}
