# 하가다 — 말씀 읊조리기

매주 관리자가 게시한 말씀을 성도들이 읊조리며 카운터로 횟수(하루 목표 100회)를 세는 모바일 웹앱.

- **성도 화면** (`/`): 말씀 본문(화면 맞춤 자동 글자 크기) + 카운터 + 100회 진행바
  + 연속 달성/레벨/말씀의 나무 + 축하 효과 + 한/영 전환. 카운트는 기본적으로
  **본인 기기(localStorage)**에 저장되며, 카카오 로그인 시 서버에 백업·기기 간 동기화된다.
- **관리자 화면** (`/admin.html`): 이메일 로그인 후 주간 말씀 게시/수정/삭제.

기술 스택: Vite + vanilla JS. **호스팅 = Vercel** (push 시 자동 배포),
**DB + 인증 = Supabase** (Postgres + Auth, 카카오 로그인 기본 지원). 전부 무료 플랜.

## 최초 설정 (1회)

### 1. Supabase 프로젝트 (https://supabase.com)

1. **New project** 생성 (리전: Northeast Asia (Seoul)).
2. **SQL Editor**에서 `supabase/schema.sql` 전체 실행
   (테이블 + RLS 정책 + 기존 말씀 데이터 시드).
3. **Authentication → Users → Add user**: 관리자 이메일/비밀번호 생성
   ("Auto Confirm User" 체크). 생성된 사용자의 **UUID 복사**.
4. SQL Editor에서 관리자 등록:
   ```sql
   insert into public.admins (user_id) values ('<관리자 UUID>');
   ```
5. **Project Settings → API**에서 **Project URL**과 **anon(public) 키** 복사.

### 2. 코드에 값 반영

`src/supabase.js`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 1-5의 값으로 교체.
(anon 키는 공개되어도 안전 — RLS 정책이 접근을 통제한다.)

### 3. 배포

저장소가 Vercel 프로젝트(`haggadah`)에 연결되어 있어 **`git push`만 하면 자동 배포**된다.
도메인 전환 전까지 Firebase Hosting도 함께 쓴다면:

```powershell
npm run build
firebase deploy --only hosting
```

## 카카오 로그인 + 하루핑 공유 DB 동기화

카카오 로그인은 하루핑(haruping.godagent.net)과 동일한 **자체 OAuth + HMAC 세션
쿠키** 방식이다 (Vercel 함수 `api/`). scope를 요청하지 않아 카카오 동의항목/비즈 앱
설정이 필요 없고, 세션 쿠키(`hp_session`)가 `.godagent.net` 공유라 하가다에서
로그인하면 하루핑에도 로그인된다 (같은 `SESSION_SECRET` 필요).

개인 기록은 하루핑이 쓰는 **dailyword(manna) Supabase Postgres**의
`HarupingUser` 테이블에 저장된다 (카카오 ID가 공통 키):
- `state` (jsonb) — 하루핑의 XP/진행 (하가다는 읽기만: xpTotal)
- `haggadah` (jsonb) — 하가다의 counts/total/achievedDays/bestStreak

**XP·레벨은 두 서비스 합산**: 하가다 XP = 읊조림 1회 1XP + 하루 100회 달성
보너스 100XP. 레벨 공식은 하루핑과 동일 (`100 + (level-1)×50`), 뱃지도 동일.

### 설정 (1회)

1. dailyword Supabase SQL Editor에서 하가다 컬럼 추가:
   ```sql
   ALTER TABLE public."HarupingUser"
     ADD COLUMN IF NOT EXISTS haggadah jsonb NOT NULL DEFAULT '{}'::jsonb;
   ```
2. Vercel(haggadah 프로젝트) 환경 변수 — **하루핑 Vercel 프로젝트의 값을 그대로 복사**:
   - `DATABASE_URL` (dailyword pooler, haruping_ro 롤)
   - `SESSION_SECRET` (하루핑과 동일해야 로그인 공유)
   - `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`
3. 카카오 개발자 콘솔(하루핑 앱) → 카카오 로그인 → Redirect URI 추가:
   `https://haggadah.godagent.net/api/auth/kakao/callback`

동작: 로그인하지 않은 사용자는 기기 로컬 저장 그대로. 상황판(📊)의
"카카오로 기록 지키기" 또는 100회 완료 카드에서 로그인하면 기록이 병합·백업되고,
다른 기기·하루핑과 이어진다. 쓰기는 조작 종료 3초 후/화면 이탈 시에만 발생한다.

## 도메인을 Vercel로 전환

1. Vercel 프로젝트 → **Settings → Domains** → `haggadah.godagent.net` 추가.
2. Cloudflare DNS에서 `haggadah` CNAME 값을 `nc-haggadah.web.app` →
   **`cname.vercel-dns.com`** 으로 변경 (프록시는 계속 DNS only).
3. 전파 후 Firebase Hosting 배포는 불필요 — 배포는 `git push`만으로 완료.

## 로컬 개발

```powershell
npm run dev          # http://localhost:5173 (실제 Supabase 프로젝트에 연결)
npm run dev -- --host   # 같은 Wi-Fi의 폰에서 접속해 터치/진동 테스트
```

## 데이터 구조

- **Supabase `haggadot`** (주간 말씀, 문서 ID = 게시일 `YYYY-MM-DD`):
  `reference / reference_en / body_ko / body_en / published_at / updated_at`
  - 성도 화면은 최신 1건만 읽으며, 30분 localStorage 캐시로 반복 접속 시 조회를 생략.
  - 쓰기는 `admins` 테이블에 등록된 관리자만 가능 (RLS).
- **Supabase `user_records`** (카카오 로그인 사용자의 개인 기록):
  `counts(jsonb) / total / achieved_days / best_streak` — 본인만 접근 (RLS).
- **localStorage `haggadah.v1`**: 일자별 카운트, 누적/달성일/최고연속, 언어 설정.
  로그인 여부와 무관하게 항상 로컬이 기준이고 서버는 백업 계층.

## 검증 체크리스트

- [ ] 익명(비로그인)으로 말씀 읽기 가능, 쓰기는 거부되는지
- [ ] +1 카운트 → 20/40/60/80 토스트, 10회 단위 효과, 100회 완료 카드
- [ ] 새로고침해도 오늘 카운트 유지, 자정이 지나면 0부터
- [ ] 연속 달성/레벨/말씀의 나무가 완료 카드에 표시되는지
- [ ] 한/영 전환이 기억되는지
- [ ] 오프라인/서버 장애 시 마지막 말씀이 캐시로 표시되는지
- [ ] 카카오 로그인 → 다른 기기에서 로그인 시 기록이 병합되는지
- [ ] iPhone SE(375px) 뷰포트에서 레이아웃, 더블탭 확대 없음, safe-area 여백
