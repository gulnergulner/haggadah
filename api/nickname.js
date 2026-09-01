// 닉네임 변경 — 하루핑과 같은 HarupingUser.nickname을 갱신 (양쪽에 반영됨)
import { getSessionUid } from './_lib/auth.js'
import { updateNickname } from './_lib/db.js'

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }
  const uid = getSessionUid(req)
  if (!uid) {
    res.status(401).json({ error: '로그인이 필요합니다.' })
    return
  }

  const nickname = String(req.body?.nickname ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '') // 제어문자 제거
    .trim()
  if (nickname.length < 1 || Array.from(nickname).length > 16) {
    res.status(400).json({ error: '닉네임은 1~16자로 해주세요.' })
    return
  }

  try {
    await updateNickname(uid, nickname)
    res.status(200).json({ ok: true, nickname })
  } catch (err) {
    console.error('닉네임 변경 오류:', err)
    res.status(500).json({ error: '저장에 실패했습니다.' })
  }
}
