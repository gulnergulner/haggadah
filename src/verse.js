import { supabase, isConfigured } from './supabase.js'
import { loadVerseCache, saveVerseCache } from './storage.js'

const REQUEST_TIMEOUT_MS = 8000
let inFlight = null

// 말씀의 주간 경계는 사용자 기기 시간대와 무관하게 한국 시간 주일이다.
export function currentWeekKey(now = new Date()) {
  const korea = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  korea.setUTCDate(korea.getUTCDate() - korea.getUTCDay())
  return korea.toISOString().slice(0, 10)
}

export function cachedVerse() {
  const data = loadVerseCache()?.data
  return data?.id <= currentWeekKey() ? data : null
}

export function cachedCurrentWeekVerse() {
  const data = cachedVerse()
  return data?.id === currentWeekKey() ? data : null
}

// DB 행(snake_case) → 앱에서 쓰는 형태(camelCase)
export function rowToVerse(row) {
  return {
    id: row.id,
    reference: row.reference,
    referenceEn: row.reference_en,
    bodyKo: row.body_ko,
    bodyEn: row.body_en,
  }
}

// 수정 시각만 먼저 확인하고 변경된 경우에만 본문을 받는다.
async function revalidateLatest() {
  if (!isConfigured) return cachedVerse()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const latestQuery = (columns) => supabase
    .from('haggadot')
    .select(columns)
    .lte('id', currentWeekKey())
    .order('id', { ascending: false })
    .limit(1)
    .abortSignal(controller.signal)
  try {
    const { data, error } = await latestQuery('id, updated_at')
    if (error) throw error
    if (!data?.length) {
      saveVerseCache(null)
      return null
    }
    const latest = data[0]
    const cache = loadVerseCache()
    if (cache?.data?.id === latest.id && latest.updated_at
      && cache.updatedAt === latest.updated_at) {
      return cache.data
    }

    // 확인 중 게시/삭제가 발생해도 본문 조회 시점의 최신 말씀을 사용한다.
    const { data: rows, error: bodyError } = await latestQuery(
      'id, reference, reference_en, body_ko, body_en, updated_at',
    )
    if (bodyError) throw bodyError
    if (!rows?.length) {
      saveVerseCache(null)
      return null
    }
    const verse = rowToVerse(rows[0])
    saveVerseCache({
      id: verse.id, data: verse, updatedAt: rows[0].updated_at,
      fetchedAt: Date.now(),
    })
    return verse
  } catch (err) {
    console.error('말씀 조회 실패:', err)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export function fetchLatest({ force = false } = {}) {
  const current = cachedCurrentWeekVerse()
  if (!force && current) return Promise.resolve(current)
  if (!inFlight) {
    inFlight = revalidateLatest().finally(() => { inFlight = null })
  }
  return inFlight.catch((err) => {
    if (force) throw err
    return cachedVerse()
  })
}
