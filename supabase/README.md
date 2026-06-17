# Supabase Security

## Apply RLS hardening

Run the SQL in `migrations/20260617_enable_rls_on_public_tables.sql` from the Supabase SQL Editor for the `haggadah` project.

This project does not call Supabase from the browser. The app server uses `SUPABASE_SERVICE_KEY`, so app-owned tables should not grant direct `anon` or `authenticated` table access.

## Verify

Run this after applying the migration:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('weekly_verses', 'app_config', 'global_stats')
order by tablename;
```

Each row should show `rowsecurity = true`.

Then confirm no direct grants remain for browser roles:

```sql
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('weekly_verses', 'app_config', 'global_stats')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

This query should return no rows.
