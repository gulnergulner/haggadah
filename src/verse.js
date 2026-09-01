import { supabase, isConfigured } from './supabase.js'
import { loadVerseCache, saveVerseCache } from './storage.js'

const FRESH_MS = 30 * 60 * 1000 // 30분 이내면 네트워크 조회 생략

export function cachedVerse() {
  return loadVerseCache()?.data || null
}

export function cacheIsFresh() {
  const c = loadVerseCache()
  return !!c && Date.now() - c.fetchedAt < FRESH_MS
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

// 최신 말씀 1건 조회. 실패하면 null 반환(호출부는 캐시를 유지).
export async function fetchLatest() {
  if (!isConfigured) return null
  try {
    const { data, error } = await supabase
      .from('haggadot')
      .select('id, reference, reference_en, body_ko, body_en')
      .order('published_at', { ascending: false })
      .limit(1)
    if (error) throw error
    if (!data?.length) return null
    const verse = rowToVerse(data[0])
    saveVerseCache({ id: verse.id, data: verse, fetchedAt: Date.now() })
    return verse
  } catch (err) {
    console.error('말씀 조회 실패:', err)
    return null
  }
}
