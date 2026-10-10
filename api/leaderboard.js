import { getSessionUid } from './_lib/auth.js'
import { getLeaderboard } from './_lib/db.js'

export function createLeaderboardHandler({ read = getLeaderboard, session = getSessionUid } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return res.status(405).json({ error: 'method not allowed' })
    }
    try {
      const ranking = await read(session(req))
      return res.status(200).json(ranking)
    } catch (err) {
      console.error('랭킹 조회 오류:', err)
      return res.status(503).json({ error: '랭킹을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' })
    }
  }
}

export default createLeaderboardHandler()
