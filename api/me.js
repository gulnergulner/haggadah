// 세션 확인 + 사용자 상태 조회: 닉네임, 하루핑 XP(state.xpTotal), 하가다 기록(haggadah)
import { getSessionUid } from './_lib/auth.js'
import { getUser } from './_lib/db.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const uid = getSessionUid(req)
  if (!uid) {
    res.status(200).json({ loggedIn: false })
    return
  }
  try {
    const row = await getUser(uid)
    res.status(200).json({
      loggedIn: true,
      nickname: row?.nickname ?? null,
      harupingXp: row?.state?.xpTotal ?? 0,
      haggadah: row?.haggadah ?? {},
    })
  } catch (err) {
    console.error('me 조회 오류:', err)
    res.status(500).json({ error: 'internal error' })
  }
}
