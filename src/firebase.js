import { initializeApp } from "firebase/app";

// TODO(설정): Firebase 콘솔 > 프로젝트 설정 > 일반 > 내 앱(웹)에서 복사한
// firebaseConfig 값으로 교체하세요. 이 값은 공개되어도 안전합니다(클라이언트용).
const firebaseConfig = {
  apiKey: "AIzaSyBjOy9yePsTnIbsIiKaqbBK03y8puTqURA",
  authDomain: "nc-haggadah.firebaseapp.com",
  projectId: "nc-haggadah",
  storageBucket: "nc-haggadah.firebasestorage.app",
  messagingSenderId: "567493130729",
  appId: "1:567493130729:web:8d5bb533fc2e0d5d83b378",
};

export const isConfigured = !firebaseConfig.apiKey.startsWith("REPLACE");

// 로컬 에뮬레이터로 개발하려면 .env.local에 VITE_EMULATOR=1 추가
export const useEmulator =
  import.meta.env.DEV && import.meta.env.VITE_EMULATOR === "1";

let app = null;

export function getFirebaseApp() {
  if (!app && isConfigured) app = initializeApp(firebaseConfig);
  return app;
}
