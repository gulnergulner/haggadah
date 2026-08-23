import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { isConfigured } from './firebase.js'
import { db } from './db.js'
import { loadVerseCache, saveVerseCache } from './storage.js'

const FRESH_MS = 30 * 60 * 1000 // 30분 이내면 네트워크 조회 생략 (Spark 읽기 절약)

export function cachedVerse() {
  return loadVerseCache()?.data || null
}

export function cacheIsFresh() {
  const c = loadVerseCache()
  return !!c && Date.now() - c.fetchedAt < FRESH_MS
}

// 최신 말씀 1건 조회. 실패하면 null 반환(호출부는 캐시를 유지).
export async function fetchLatest() {
  if (!isConfigured || !db) return null
  try {
    const snap = await getDocs(
      query(collection(db, 'haggadot'), orderBy('publishedAt', 'desc'), limit(1)),
    )
    if (snap.empty) return null
    const docSnap = snap.docs[0]
    const { publishedAt, updatedAt, ...fields } = docSnap.data()
    const data = { id: docSnap.id, ...fields }
    saveVerseCache({ id: docSnap.id, data, fetchedAt: Date.now() })
    return data
  } catch (err) {
    console.error('말씀 조회 실패:', err)
    return null
  }
}
