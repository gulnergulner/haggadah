// 로그인 사용자의 하가다 기록 저장 — HarupingUser.haggadah 컬럼만 갱신
// (하루핑의 state 컬럼은 건드리지 않으므로 두 서비스가 안전하게 공존)
import { getSessionUid } from './_lib/auth.js'
import { saveHaggadah } from './_lib/db.js'

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

  const body = req.body || {}
  // 화이트리스트 필드만, 크기 제한
  const counts = {}
  if (body.counts && typeof body.counts === 'object') {
    for (const [day, n] of Object.entries(body.counts)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && typeof n === 'number' && n >= 0) {
        counts[day] = Math.floor(n)
      }
    }
  }
  const num = (v) => (typeof v === 'number' && v >= 0 ? Math.floor(v) : 0)
  const data = {
    counts,
    total: num(body.total),
    achievedDays: num(body.achievedDays),
    bestStreak: num(body.bestStreak),
  }
  if (JSON.stringify(data).length > 100_000) {
    res.status(413).json({ error: '상태가 너무 큽니다.' })
    return
  }

  try {
    await saveHaggadah(uid, data)
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('haggadah-state 저장 오류:', err)
    res.status(500).json({ error: '저장에 실패했습니다.' })
  }
}
