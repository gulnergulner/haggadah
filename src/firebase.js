import { initializeApp } from 'firebase/app'

// TODO(설정): Firebase 콘솔 > 프로젝트 설정 > 일반 > 내 앱(웹)에서 복사한
// firebaseConfig 값으로 교체하세요. 이 값은 공개되어도 안전합니다(클라이언트용).
const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
}

export const isConfigured = !firebaseConfig.apiKey.startsWith('REPLACE')

// 로컬 에뮬레이터로 개발하려면 .env.local에 VITE_EMULATOR=1 추가
export const useEmulator =
  import.meta.env.DEV && import.meta.env.VITE_EMULATOR === '1'

let app = null

export function getFirebaseApp() {
  if (!app && isConfigured) app = initializeApp(firebaseConfig)
  return app
}
