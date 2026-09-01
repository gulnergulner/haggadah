-- 하가다 Supabase 스키마. SQL Editor에서 전체 실행 (여러 번 실행해도 안전).

-- ---------- 주간 말씀 ----------
create table if not exists public.haggadot (
  id text primary key,               -- 게시일 'YYYY-MM-DD'
  reference text not null,           -- 출처 (한글)
  reference_en text not null,        -- 출처 (영문)
  body_ko text not null,
  body_en text not null,
  published_at timestamptz not null, -- 게시일에서 결정적으로 생성 (정렬 기준)
  updated_at timestamptz not null default now()
);

alter table public.haggadot enable row level security;

-- ---------- 개인 기록 (카카오 로그인 사용자) ----------
create table if not exists public.user_records (
  user_id uuid primary key references auth.users (id) on delete cascade,
  counts jsonb not null default '{}'::jsonb, -- { 'YYYY-MM-DD': 횟수 }
  total integer not null default 0,
  achieved_days integer not null default 0,
  best_streak integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.user_records enable row level security;

-- ---------- 관리자 목록 ----------
-- Auth에서 관리자 계정 생성 후 그 UUID를 이 테이블에 넣는다:
--   insert into public.admins (user_id) values ('<관리자 UUID>');
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.admins enable row level security;

-- 정책 서브쿼리가 admins의 RLS에 막히지 않도록 security definer 함수 사용
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- RLS 정책 ----------
drop policy if exists "haggadot 공개 읽기" on public.haggadot;
create policy "haggadot 공개 읽기" on public.haggadot
  for select using (true);

drop policy if exists "haggadot 관리자 쓰기" on public.haggadot;
create policy "haggadot 관리자 쓰기" on public.haggadot
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "user_records 본인만" on public.user_records;
create policy "user_records 본인만" on public.user_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- admins 테이블은 정책 없음 = 클라이언트 접근 전면 차단 (is_admin 함수로만 조회)

-- ---------- 기존 Firestore 데이터 이전 ----------
insert into public.haggadot (id, reference, reference_en, body_ko, body_en, published_at)
values
  (
    '2026-08-23',
    '신명기 12:18-19',
    'Deuteronomy 12:18-19',
    E'오직 네 하나님 여호와께서 택하실 곳에서 네 하나님 여호와 앞에서 너는 네 자녀와 노비와 성중에 거주하는 레위인과 함께 그것을 먹고 또 네 손으로 수고한 모든 일로 말미암아 네 하나님 여호와 앞에서 즐거워하되\n너는 삼가 네 땅에 거주하는 동안에 레위인을 저버리지 말지니라',
    E'Instead, you are to eat them in the presence of the LORD your God at the place the LORD your God will choose--you, your sons and daughters, your menservants and maidservants, and the Levites from your towns--and you are to rejoice before the LORD your God in everything you put your hand to.\nBe careful not to neglect the Levites as long as you live in your land.',
    '2026-08-22T15:00:00Z'
  ),
  (
    '2026-08-30',
    '신명기 12:27-28',
    'Deuteronomy 12:27-28',
    E'네가 번제를 드릴 때에는 그 고기와 피를 네 하나님 여호와의 제단에 드릴 것이요 네 제물의 피는 네 하나님 여호와의 제단 위에 붓고 그 고기는 먹을지니라,\n내가 네게 명령하는 이 모든 말을 너는 듣고 지키라 네 하나님 여호와의 목전에 선과 의를 행하면 너와 네 후손에게 영구히 복이 있으리라',
    E'Present your burnt offerings on the altar of the LORD your God, both the meat and the blood. The blood of your sacrifices must be poured beside the altar of the LORD your God, but you may eat the meat.\nBe careful to obey all these regulations I am giving you, so that it may always go well with you and your children after you, because you will be doing what is good and right in the eyes of the LORD your God.',
    '2026-08-29T15:00:00Z'
  )
on conflict (id) do nothing;
