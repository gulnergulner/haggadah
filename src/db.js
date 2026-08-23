import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getFirebaseApp, isConfigured, useEmulator } from './firebase.js'

// Firestore만 사용하는 성도 페이지가 Auth 번들을 끌어오지 않도록 분리
let db = null

if (isConfigured) {
  db = getFirestore(getFirebaseApp())
  if (useEmulator) connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

export { db }
