# 하가다 — 말씀 읊조리기

매주 관리자가 게시한 말씀을 성도들이 읊조리며 카운터로 횟수(하루 목표 100회)를 세는 모바일 웹앱.

- **성도 화면** (`/`): 말씀 본문 + 대형 탭 카운터 + 진행 링 + 25/50/75/100 마일스톤 축하 + 한/영 전환 + 화면 꺼짐 방지. 카운트는 **본인 기기(localStorage)에만** 저장되며 로그인이 필요 없다.
- **관리자 화면** (`/admin.html`): 이메일 로그인 후 주간 말씀 게시/수정/삭제.

기술 스택: Vite + vanilla JS, Firebase Hosting + Firestore + Auth (무료 Spark 플랜).

## 최초 설정 (1회)

### 1. Firebase 콘솔 작업 (https://console.firebase.google.com)

1. **프로젝트 추가** (예: `nc-haggadah`). Google Analytics는 꺼도 됨.
2. **Firestore Database 만들기**: production 모드, 리전 `asia-northeast3`(서울).
3. **Authentication → Sign-in method**: `이메일/비밀번호` 사용 설정.
4. **Authentication → Users → 사용자 추가**: 관리자 이메일/비밀번호 등록 후 **UID 복사**.
5. **프로젝트 설정 → 일반 → 내 앱 → 웹 앱(`</>`) 추가**: `firebaseConfig` 객체 복사.

### 2. 코드에 값 반영

| 파일 | 바꿀 내용 |
|---|---|
| `src/firebase.js` | `firebaseConfig`를 콘솔에서 복사한 값으로 교체 |
| `firestore.rules` | `REPLACE_WITH_ADMIN_UID` → 4번에서 복사한 관리자 UID |
| `.firebaserc` | `REPLACE_WITH_PROJECT_ID` → Firebase 프로젝트 ID |

### 3. 설치 및 배포

```powershell
npm install
npm install -g firebase-tools   # 최초 1회
firebase login                  # 최초 1회
firebase deploy --only firestore:rules
npm run build
firebase deploy --only hosting
```

배포 후 `https://<프로젝트ID>.web.app` 접속 → `/admin.html`에서 로그인 → 첫 말씀 게시.

## 로컬 개발

```powershell
npm run dev          # http://localhost:5173 (실제 Firebase 프로젝트에 연결)
npm run dev -- --host   # 같은 Wi-Fi의 폰에서 접속해 터치/진동 테스트
```

실서버 대신 에뮬레이터로 개발하려면:

1. 프로젝트 루트에 `.env.local` 파일 생성, 내용: `VITE_EMULATOR=1`
2. 별도 터미널에서 `firebase emulators:start` (Auth 9099 / Firestore 8080 / UI 4000)
3. 에뮬레이터 UI(http://localhost:4000)에서 Auth 사용자와 `haggadot` 문서를 시드

## 데이터 구조

Firestore 컬렉션 `haggadot`, 문서 ID = 게시일 `YYYY-MM-DD`:
`reference / referenceEn / bodyKo / bodyEn / publishedAt / updatedAt`

- 성도 화면은 최신 1건만 읽으며(`orderBy publishedAt desc, limit 1`), 30분 localStorage 캐시로 반복 접속 시 Firestore 읽기를 생략한다 (무료 한도 보호 + 오프라인 동작).
- 쓰기는 `firestore.rules`에 하드코딩된 관리자 UID만 가능. 관리자가 여러 명이면 rules의 배열에 UID를 추가하고 rules를 재배포.

## 검증 체크리스트

- [ ] 익명(비로그인)으로 말씀 읽기 가능, 쓰기는 거부되는지
- [ ] 탭 카운트 → 25/50/75에서 색종이+토스트, 100에서 완료 오버레이 (이후에도 계속 카운트 가능)
- [ ] 새로고침해도 오늘 카운트 유지, 자정이 지나면 0부터
- [ ] −1(즉시), 리셋(확인 후), 0 아래로 안 내려감
- [ ] 한/영 전환이 기억되는지
- [ ] 오프라인/서버 장애 시 마지막 말씀이 캐시로 표시되는지
- [ ] iPhone SE(375px) 뷰포트에서 레이아웃, 더블탭 확대 없음, safe-area 여백
- [ ] 배포 URL(HTTPS)에서 ☀️ 화면 꺼짐 방지 동작
