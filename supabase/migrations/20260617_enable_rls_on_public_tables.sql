-- Enable RLS and remove public Data API access for app-owned tables.
-- The app accesses these tables only from server-side code with SUPABASE_SERVICE_KEY.

alter table if exists public.weekly_verses enable row level security;
alter table if exists public.app_config enable row level security;
alter table if exists public.global_stats enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['weekly_verses', 'app_config', 'global_stats']
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', table_name);
      execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
    end if;
  end loop;
end $$;

-- The global counter RPC is called only by the server with the service role.
do $$
declare
  routine record;
begin
  for routine in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'increment_global_count'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', routine.signature);
    execute format('grant execute on function %s to service_role', routine.signature);
  end loop;
end $$;

-- Prevent future public schema tables/functions from being exposed by default.
alter default privileges in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;

alter default privileges in schema public
  revoke execute on functions from anon, authenticated;
