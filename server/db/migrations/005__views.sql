-- 005__views.sql — Public view for whatsapp_sessions (used by client via Supabase Realtime)
-- Exposes only non-sensitive columns; membership check embedded in the view definition.
-- The view owner (postgres) bypasses RLS on whatsapp_sessions; the WHERE clause
-- enforces tenant isolation instead.

create or replace view whatsapp_sessions_public as
  select
    ws.tenant_id,
    ws.status,
    ws.phone_number,
    ws.last_heartbeat_at,
    ws.last_error
  from whatsapp_sessions ws
  where exists (
    select 1 from tenant_members tm
    where tm.tenant_id = ws.tenant_id
      and tm.user_id = auth.uid()
  );

-- Grant read access to authenticated users
grant select on whatsapp_sessions_public to authenticated;

-- Enable Supabase Realtime on conversations and messages tables.
-- (whatsapp_sessions_public is queried via regular select + polling / channel filter;
--  the underlying whatsapp_sessions table is not in the realtime publication.)
begin;
  -- idempotent: add tables to supabase_realtime publication if not already present
  do $$
  begin
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and tablename = 'conversations'
    ) then
      alter publication supabase_realtime add table conversations;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table messages;
    end if;
  end;
  $$;
commit;
