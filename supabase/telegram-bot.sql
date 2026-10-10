-- 기존 하가다(말씀) Supabase SQL Editor에서 한 번 실행한다.
-- 하루핑/개인 기록용 DB가 아니다. 반복 실행해도 안전하다.
create table if not exists public.telegram_verse_updates (
  update_id bigint primary key,
  verse_date text not null,
  source_time bigint not null,
  message_id bigint not null,
  received_at timestamptz not null default now()
);
alter table public.telegram_verse_updates enable row level security;
revoke all on public.telegram_verse_updates from anon, authenticated;
create index if not exists telegram_verse_updates_date_idx
  on public.telegram_verse_updates (verse_date, update_id desc);

create or replace function public.publish_telegram_verse(p_update_id bigint, p_verse jsonb, p_event_time bigint, p_message_id bigint)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  date_key text := p_verse->>'id';
  claimed integer;
begin
  if date_key is null or date_key !~ '^\d{4}-\d{2}-\d{2}$' or p_update_id is null or p_update_id < 0
    or p_event_time is null or p_event_time < 1 or p_message_id is null or p_message_id < 1 then
    raise exception 'invalid publication';
  end if;
  -- 같은 날짜에 대한 병렬 수신도 순차 처리한다.
  perform pg_advisory_xact_lock(hashtextextended(date_key, 0));
  insert into public.telegram_verse_updates(update_id, verse_date, source_time, message_id)
    values(p_update_id, date_key, p_event_time, p_message_id) on conflict do nothing;
  get diagnostics claimed = row_count;
  if claimed = 0 then return 'duplicate'; end if;
  if exists(select 1 from public.telegram_verse_updates
    where verse_date = date_key and
      (source_time, update_id) > (p_event_time, p_update_id)) then
    return 'stale';
  end if;

  insert into public.haggadot(id, reference, reference_en, body_ko, body_en, published_at, updated_at)
    values(date_key, p_verse->>'reference', p_verse->>'reference_en',
      p_verse->>'body_ko', p_verse->>'body_en',
      date_key::date::timestamp at time zone 'Asia/Seoul', now())
    on conflict(id) do update set
      reference = excluded.reference, reference_en = excluded.reference_en,
      body_ko = excluded.body_ko, body_en = excluded.body_en,
      published_at = excluded.published_at, updated_at = excluded.updated_at
    where (haggadot.reference, haggadot.reference_en, haggadot.body_ko, haggadot.body_en, haggadot.published_at)
      is distinct from (excluded.reference, excluded.reference_en, excluded.body_ko, excluded.body_en, excluded.published_at);
  return 'saved';
end;
$$;
revoke all on function public.publish_telegram_verse(bigint, jsonb, bigint, bigint) from public, anon, authenticated;
grant execute on function public.publish_telegram_verse(bigint, jsonb, bigint, bigint) to service_role;
