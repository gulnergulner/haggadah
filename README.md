# 하가다 — 말씀 읊조리기

매주 관리자가 게시한 말씀을 성도들이 읊조리며 카운터로 횟수(하루 목표 100회)를 세는 모바일 웹앱.

- **성도 화면** (`/`): 말씀 본문(화면 맞춤 자동 글자 크기) + 카운터 + 100회 진행바
  + 날짜 양옆의 `<` / `>` 버튼으로 이전·다음 게시 말씀 탐색. 지난 말씀에는 게시일을,
  최신 말씀에는 오늘 날짜를 표시한다. 게시되지 않은 주차는 건너뛰고 미래 말씀은 제외한다.
  지난 말씀을 보는 동안 자동 갱신은 탐색을 유지하며, 새로고침은 보고 있는 말씀을 확인한다.
  읊조림 횟수는 보고 있는 말씀과 관계없이 오늘 기록에 저장된다.
  + 상황판(📊)의 **랭킹 보기**: 카카오 연결 사용자의 서버 저장 누적 읊조림 상위 50명과
  내 순위. 동점은 공동 순위이며 닉네임·누적 횟수만 표시한다. 비로그인도 열람 가능하다.
  + 카카오 로그인 버튼을 누르면 진행 메시지와 회전 표시를 보여주고 중복 클릭을 막는다.
  로그인 후 계정 확인 중에도 대기 메시지를 표시하며, 뒤로 돌아오면 버튼을 다시 활성화한다.
  + 리셋·영문 오른쪽 **공유** 버튼: `100번 읊조렸습니다.` 뒤에 빈 줄을 하나 두고 현재 말씀의
  한글 본문 전체와 `[시편 1장 2절]` 출처를 공유한다. 링크는 포함하지 않는다.
  휴대폰 공유창에서 카카오톡을 선택하며, 공유창을 지원하지 않는 환경에서는
  메시지를 복사해 카카오톡에 붙여 넣는다. 로그인 없이도 사용 가능하다.
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

## 텔레그램으로 말씀 게시

기존 관리자 화면 대신 **@haggadah_admin_bot**과의 개인 대화에 아래 내용을 한 메시지로
보내면 같은 `haggadot` 테이블에 저장된다. 게시 권한은 `TELEGRAM_ADMIN_IDS`에 등록한
숫자 사용자 ID로 제한하며, 현재 관리자는 `62340378`이다.

```text
2026-10-04

[신15:4] 네가 만일 네 하나님 여호와의 말씀만 듣고 내가 오늘 네게 내리는 그 명령을 다 지켜 행하면 네 하나님 여호와께서 네게 기업으로 주신 땅에서 네가 반드시 복을 받으리니 너희 중에 가난한 자가 없으리라

[Dt 15:4, NIV] However, there need be no poor people among you, for in the land the LORD your God is giving you to possess as your inheritance, he will richly bless you,
```

- 날짜는 보낸 날짜가 아니라 첫 줄의 날짜를 사용한다. 한국 시간 해당 날짜 00:00을
  `published_at`으로 저장하므로 기존 웹 관리자에서 `2026-10-04`로 게시한 것과 같다.
- 한글·영문 성경 약칭을 정식 이름으로 바꾸고, 본문 전체와 본문 내부 줄바꿈은 보존한다.
  영문 출처의 `NIV` 같은 번역판 표시는 본문에 넣지 않는다.
- 한글·영문 구절이 다르거나 날짜·형식이 잘못되면 저장하지 않고 수정 안내를 보낸다.
  여러 절은 `[신15:4-5]` 범위나 각 절의 `[출처]`로 입력할 수 있다.
- 같은 날짜를 다시 보내거나 텔레그램 메시지를 수정하면 해당 날짜의 말씀을 수정한다.
  중복 수신은 다시 저장하지 않고, 늦게 도착한 이전 메시지는 최신 메시지를 덮어쓰지 않는다.
- 미래 주일 말씀도 미리 등록할 수 있으며 기존 성도 화면의 주일 기준 표시 규칙을 따른다.
  이미 캐시된 금주 말씀의 수정은 앱의 말씀 새로고침 버튼으로 확인한다.
- `/start`, `/help`로 입력 형식을 확인할 수 있다. 미등록 사용자는 본인의 숫자 ID와
  권한 안내만 받으며 게시할 수 없다. 그룹·채널에서는 게시하지 않는다.

### 연결 설정 (최초 1회)

1. **말씀용** Supabase 프로젝트 `wjyiovkeduosubtzflqe`의 SQL Editor에서
   [supabase/telegram-bot.sql](supabase/telegram-bot.sql)을 실행한다. 원자적 저장 함수와
   중복 수신 기록을 만들며 서버용 `service_role`만 저장 함수를 호출할 수 있다.
2. 로컬 `.env.local`과 Vercel Production 환경 변수에 아래 값을 설정한다:

   | 환경 변수 | 값 |
   | --- | --- |
   | `TELEGRAM_ADMIN_IDS` | `62340378` (여러 명은 쉼표로 구분) |
   | `TELEGRAM_WEBHOOK_SECRET` | 로컬에 생성한 비밀 문자열과 같은 값 |
   | `HAGGADAH_SUPABASE_SERVICE_ROLE_KEY` | 말씀 프로젝트의 서버용 service_role 키 |
   | `HAGGADAH_SUPABASE_URL` | 기본값 `https://wjyiovkeduosubtzflqe.supabase.co`, 보통 생략 |

   봇 토큰 `TELEGRAM_BOT_TOKEN`은 로컬 `.env.local`에만 필요하다. 운영 웹훅은 응답 JSON으로
   답장하므로 토큰을 사용하지 않는다. 기존 `.env`의 개인 기록용 `SUPABASE_SERVICE_KEY`와
   `DATABASE_URL`은 말씀 게시에 사용하지 않는다. 서버 키는 `VITE_` 접두사로 등록하지 않는다.
3. 코드와 환경 변수를 배포한다. 웹훅 주소는
   `https://haggadah.godagent.net/api/telegram-webhook`이다.
4. 로컬에서 `npm run telegram:setup`을 실행하면 기존 봇에 웹훅을 등록한다.
   입력·수정 메시지만 받으며, 대기 중인 메시지를 삭제하지 않는다. 다른 도메인을 쓴다면
   `TELEGRAM_WEBHOOK_URL`을 HTTPS 주소로 설정한다.
5. 봇에 예시 형식으로 메시지를 보내 게시 완료 답장을 확인한다. 관리자 화면의 같은 날짜
   항목과 성도 화면의 말씀을 확인한다. 테스트도 실제 게시되므로 날짜와 내용을 확인하고 보낸다.

구현은 [Telegram 공식 웹훅 API](https://core.telegram.org/bots/api#setwebhook)의 비밀 헤더와
[웹훅 응답으로 답장하기](https://core.telegram.org/bots/api#making-requests-when-getting-updates)를 사용한다.

검증: `node --test scripts/telegram-test.mjs scripts/telegram-db-test.mjs`.
DB 검증은 로컬 PostgreSQL의 별도 임시 DB만 사용하며 운영에는 연결하지 않는다.
PostgreSQL 경로를 자동으로 찾지 못하면 `PG_BIN`을 `initdb`와 `pg_ctl`이 있는 디렉토리로 지정한다.

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

## 읊조림 메시지 공유

공유 버튼은 [Web Share API](https://www.w3.org/TR/web-share/)에 `text`만 전달한다.
URL·페이지 제목은 포함하지 않으며, 누적 횟수 대신 버튼을 누른 시점의 오늘 카운터를
사용한다. 횟수 뒤에 빈 줄을 하나 두고 보고 있는 말씀의 한글 본문 전체(줄바꿈 유지)와 `[성경 장 절]`
출처를 붙인다. 과거 말씀 탐색 시에도 현재 보고 있는 말씀을 사용하며, 영어 화면에서도
공유 메시지는 한글이다. 말씀이 없거나 로딩 중이면 안내 후 공유를 보류한다.
카카오톡 공유 SDK는 텍스트 템플릿에도 링크가 필수여서 사용하지 않는다.
JavaScript 키와 별도 카카오 앱 설정은 필요하지 않다.

휴대폰의 공유창에서 카카오톡을 선택한다. 지원하지 않거나 공유창을 열지 못하면 메시지를
클립보드에 복사하고 안내한다. 공유창을 취소하면 복사하거나 완료 메시지를 표시하지 않는다.
Web Share와 클립보드는 HTTPS 또는 `localhost`에서 사용할 수 있다.

## 로컬 개발

```powershell
npm run dev          # http://localhost:5173 (실제 Supabase 프로젝트에 연결)
npm run dev -- --host   # 같은 Wi-Fi의 폰에서 접속해 터치/진동 테스트
```

로컬 랭킹 API는 `.env.local`의 `DATABASE_URL`(dailyword DB)을 사용한다.
로그인 사용자의 내 순위 조회에는 `SESSION_SECRET`도 필요하다. 환경 변수가 없으면
랭킹 화면에서 조회 실패와 재시도 버튼을 표시한다. 운영 환경은 기존 Vercel 환경 변수를 사용한다.

## 데이터 구조

- **Supabase `haggadot`** (주간 말씀, 문서 ID = 게시일 `YYYY-MM-DD`):
  `reference / reference_en / body_ko / body_en / published_at / updated_at`
  - 한국 시간 기준 이번 주 주일까지 게시된 최신 말씀을 표시한다. 주일 아침 새 말씀이
    등록되기 전에는 이전 주 말씀을 계속 사용하며, 미래 주차 말씀은 미리 표시하지 않는다.
  - 캐시의 게시일이 한국 시간 이번 주 주일과 같으면 즉시 표시하고 자동 조회를 생략한다.
    재접속/화면 복귀/네트워크 복구 및 시간이 경과한 경우에도 동일하다.
  - 금주 말씀을 아직 받지 않은 경우에만 접속/화면 복귀/네트워크 복구 및 화면이 보이는
    동안 1분마다 `id + updated_at`을 확인한다. 변경 시에만 본문 1건을 받는다.
  - 금주 말씀 수신 전 최초 표시에는 서버 확인을 기다리며, 실패하거나 8초 내 응답이
    없으면 저장된 말씀을 사용한다. 다음 주일이 되면 새 게시 여부 확인을 재개한다.
  - 금주 말씀을 받은 뒤 관리자가 수정/삭제한 내용은 말씀 출처 옆 새로고침 버튼으로
    확인한다. 수정 시각이 바뀌면 본문 1건을 갱신하고, 같으면 캐시를 재사용한다.
    실패 시 기존 말씀을 유지하고 오류를 알린다.
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
- [ ] 주일 새 말씀 게시 전에는 이전 말씀 유지, 게시 후 재접속/화면 복귀 시 새 말씀 표시
- [ ] 금주 말씀 수신 후에는 시간 경과/재접속/화면 복귀에서도 자동 말씀 요청이 0건인지
- [ ] 금주 말씀 수정은 새로고침 버튼으로 반영되며, 같으면 본문을 다시 받지 않는지
- [ ] 말씀 새로고침 버튼으로 즉시 확인 가능하며 실패 시 기존 말씀이 유지되는지
- [ ] 다음 주일에는 조회를 재개하고, 새 게시 전에는 기존 말씀을 유지하는지
- [ ] 카카오 로그인 → 다른 기기에서 로그인 시 기록이 병합되는지
- [ ] iPhone SE(375px) 뷰포트에서 레이아웃, 더블탭 확대 없음, safe-area 여백
