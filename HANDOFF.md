# HANDOFF — 하가다(haggadah) 프로젝트 인수인계

작성일: 2026-09-03. 이 문서는 지금까지의 작업 내역, 아키텍처 결정과 그 이유,
남은 할 일을 정리한 것이다. 설정 절차의 세부는 [README.md](README.md) 참조.

## 1. 서비스 개요

새가나안교회 성도들이 매주 말씀을 읊조리며 하루 100회를 세는 모바일 웹앱.

- 성도 화면 `/` : 말씀(화면 맞춤 자동 폰트) + 카운터 + 진행바 + 여정(연속/레벨/나무) + 축하 효과
- 관리자 화면 `/admin.html` : 이메일 로그인 후 주간 말씀 게시/수정/삭제
- 상황판(📊/칭호 배지 탭): 나의 여정 + 카카오 로그인 + 하루핑·만나 바로가기

## 2. 최종 아키텍처

| 역할 | 서비스 | 비고 |
|---|---|---|
| 호스팅 + API | **Vercel** 프로젝트 `haggadah` | `git push` → 자동 배포. `vercel.json`(vite/dist/cleanUrls) |
| 도메인 | `haggadah.godagent.net` | Cloudflare DNS → CNAME `vercel-dns` (프록시 OFF) |
| 말씀 DB + 관리자 인증 | **Supabase** `wjyiovkeduosubtzflqe` | `haggadot`/`admins` 테이블 + RLS, 이메일 로그인 |
| 개인 기록 DB | **dailyword(manna) Supabase Postgres** | 하루핑과 공유하는 `HarupingUser` 테이블 |
| 카카오 로그인 | **자체 OAuth** (Vercel 함수 `api/`) | 하루핑과 동일 방식·동일 카카오 앱·동일 세션 시크릿 |
| 비용 | 전부 무료 | Vercel Hobby + Supabase Free ×2 |

Firebase(nc-haggadah)는 **완전 철수** — 코드에서 제거됨. (nc-haggadah.web.app에
구버전 사본이 남아 있고, Firestore에 과거 말씀 백업이 남아 있음.)

## 3. 데이터 구조

### Supabase(하가다) — 말씀
- `haggadot`: id(=게시일 YYYY-MM-DD) / reference / reference_en / body_ko / body_en / published_at
  - 읽기 공개, 쓰기는 `admins` 테이블 등록자만 (RLS + `is_admin()` security definer)
  - 한국 시간 이번 주 주일까지의 최신 1건 표시. 캐시가 금주 말씀이면 즉시 표시하고
    자동 말씀 통신을 생략한다 (시간 경과/재접속/복귀에도 동일).
    같은 주 수정/삭제는 말씀 출처 옆 새로고침 버튼으로 확인한다.
    수정 시각이 바뀐 경우에만 본문 갱신, 실패 시 캐시 유지.
    금주 말씀 수신 전에는 접속/화면 복귀/온라인 복구 및 화면이 보이는 동안 1분마다
    id/updated_at 확인, 변경 시에만 본문 갱신. 다음 주일에는 조회 재개.
    주일 새 게시 전에는 이전 주 말씀 유지, 통신 실패 시 캐시 사용 (8초 타임아웃).
- 스키마 원본: [supabase/schema.sql](supabase/schema.sql)
- ⚠️ `user_records` 테이블은 초기 설계의 잔재 — 현재 미사용 (삭제해도 됨)

### dailyword Postgres — 개인 기록 (하루핑 공유)
- `HarupingUser`: id(카카오 숫자 id, text PK) / nickname / **state**(jsonb, 하루핑 전용)
  / **haggadah**(jsonb, 하가다 전용) / createdAt / updatedAt
- 하가다는 `haggadah` 컬럼만 쓰고 `state`는 xpTotal만 읽는다 (하루핑도 반대로 동일)
  → 두 서비스가 서로의 데이터를 덮어쓰지 않음
- `haggadah` 컬럼 내용: `{ counts: {날짜:횟수}, total, achievedDays, bestStreak }`
- 접속: DATABASE_URL(transaction pooler 6543, `prepare:false` 필수, haruping_ro 롤)

### localStorage (기기, 항상 기준=source of truth)
- `haggadah.v1`: counts(일자별)/total/achievedDays/bestStreak/lang
- `verseFontDelta`(글자 크기 보정), `haggadah.verseCache`(말씀 본문 + updatedAt 버전 캐시),
  `haggadah.fx.v1`(직전 효과), `haggadah.kakaoNudge`(안내 토스트 1회)

## 4. 카카오 로그인 (하루핑 방식)

- 흐름: `/api/auth/kakao` → kauth 인가(state 쿠키, **scope 없음**) → `/api/auth/kakao/callback`
  → 토큰 교환 → 사용자 id → `HarupingUser` upsert(닉네임 없으면 성경 인물 랜덤)
  → HMAC 세션 쿠키 `hp_session` (90일)
- **scope를 요청하지 않으므로 동의항목·비즈 앱 설정 불필요** (Supabase OIDC 방식의
  KOE205 오류를 이것으로 해결)
- 세션 쿠키 Domain=`.godagent.net` + 하루핑과 같은 `SESSION_SECRET`
  → **하가다에서 로그인하면 하루핑도 로그인됨** (역방향은 하루핑이 호스트 쿠키라 불가;
  하루핑도 Domain 쿠키로 바꾸면 양방향 가능 — 남은 개선 후보)
- 서버 함수: api/auth/kakao, callback, logout, me, haggadah-state(PUT), nickname(PUT)
  공용 로직은 api/_lib/{auth,db}.js (US `_` 접두 폴더는 Vercel이 엔드포인트로 노출 안 함)

## 5. XP·레벨 (하루핑과 합산)

- 하가다 XP = **읊조림 1회 1XP + 하루 100회 달성 보너스 100XP** (= total + achievedDays×100)
- 합산 XP = 하루핑 `state.xpTotal` + 하가다 XP. 레벨 공식은 하루핑과 동일:
  `xpNeedFor(level) = 100 + (level-1)×50`, 뱃지 3레벨마다 🌱🌿🍀🌸🌳⭐🌟💎👑🏆
- **XP 풀은 분리 저장, 표시만 합산** — 이중 합산/유실 없음. 양쪽 다 접속 시
  `/api/me`로 상대 XP를 받아 같은 레벨을 표시 (하루핑 쪽 수정 커밋: haruping `d30655c`)
- 레벨은 서버 응답 도착 후에만 표시 (처음엔 숨김 → 값 점프 방지)

## 6. 동기화 시점 (로그인 사용자만)

- 읽기: 접속 시 1회 (`/api/me` → 일자별 큰 값 병합 → 병합 결과 재저장)
- 쓰기: ① 조작 멈춘 뒤 3초(디바운스) ② 100회 달성 즉시 ③ 화면 이탈(visibilitychange)
- 비로그인: 서버 통신 없음, 기기 로컬만

## 7. 주요 결정 사항과 이유

1. **UI는 기존 newcanaanph.org 하가다 페이지의 사용성 유지**가 최우선 (버튼 배치/색 유지).
   이후 개편도 리셋(빨강)/영문(파랑)/+1(초록), 날짜+배지 상단 구조는 보존.
2. 말씀 본문은 **프레임/카드 구분 없이** 페이지 배경 위에, **화면에 잘리지 않는 최대
   폰트로 자동 맞춤** (이진 탐색). ± 버튼은 줄이는 방향 보정만 저장(`verseFontDelta`).
3. 호스팅 변천: Firebase Hosting → (Vercel+Firebase 이중 구성 거부) → Firebase 단독
   검토(OIDC는 50 MAU 초과 유료, Cloud Functions는 Blaze 카드 필요) → **최종: Vercel
   호스팅 + Supabase DB** (완전 무료, 카드 불필요).
4. 카카오 로그인: Supabase 내장 OIDC는 email scope가 하드코딩(추가 scope는 append만 됨)
   → KOE205 해결 불가 → **하루핑의 자체 OAuth 이식**으로 해결.
5. DB 통합: 하가다 기록을 하루핑의 `HarupingUser`로 이전하되 **별도 jsonb 컬럼**으로
   격리 (하루핑의 state 전체 덮어쓰기 로직과 충돌 방지).
6. 관리자 게시일의 `published_at`은 게시일에서 결정적으로 생성 → 과거 말씀을 수정해도
   최신 정렬이 바뀌지 않음.
7. 리셋 버튼은 기존 UX대로 확인 없이 즉시 실행. 관리자 폼에서 제목 필드는 제거됨.

## 8. 남은 할 일

- [ ] **실기기 카카오 로그인 최종 검증** — 새 방식(자체 OAuth)으로 실제 로그인 →
      동기화 → 닉네임 변경 → 하루핑 자동 로그인 확인 (KOE205는 구방식 오류였음)
- [ ] **newcanaanph.org/nc/haggadah.html 교체 업로드** — [legacy/haggadah.html](legacy/haggadah.html)
      (새 주소 리다이렉트). 업로드 여부 미확인.
- [ ] **하루핑 → 하가다 소개 링크** (하루핑 저장소에서 작업; 하가다→하루핑·만나는 완료)
- [ ] (선택) 하루핑 세션 쿠키를 `.godagent.net`으로 바꿔 **양방향** 로그인 공유
- [ ] (선택) Firebase 정리: nc-haggadah 커스텀 도메인 항목 삭제, web.app 사본 처리,
      저장소의 firebase.json/.firebaserc 제거
- [ ] (선택) Supabase(하가다)의 미사용 `user_records` 테이블·카카오 공급자 설정 제거
- [ ] (개선 후보) 이번 달 달성 달력 뷰 / 칭호 승급(3·7·14일…) 특별 연출 /
      관리자 화면에 로그인 사용자 수 통계

## 9. 운영 정보

- 배포: **`git push`가 전부** (Vercel 자동 빌드). Firebase 배포 단계는 폐지됨.
- 저장소: github.com/gulnergulner/haggadah (gh CLI 활성 계정 gulnergulner)
- Vercel 환경 변수(haggadah 프로젝트): `DATABASE_URL`, `SESSION_SECRET`,
  `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET` — 모두 하루핑 프로젝트와 동일 값
- 카카오 앱: 하루핑과 공유. Redirect URI에
  `https://haggadah.godagent.net/api/auth/kakao/callback` 등록됨
- 검증: `npm run build` + `npm run preview`(4173) + `node scripts/smoke.mjs`
  (headless Edge, 전체 사용자 흐름 + 스크린샷 scripts/shot-*.png)
- 로그인 사용자 수 확인: dailyword SQL Editor에서
  `select count(*) from "HarupingUser" where haggadah <> '{}'::jsonb;`
