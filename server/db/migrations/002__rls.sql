-- 002__rls.sql — Enable RLS on all tenant-scoped tables + policies

-- ============================================================
-- tenants — members can read their own tenant row
-- ============================================================
alter table tenants enable row level security;

create policy "tenants_select" on tenants
  for select using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = tenants.id
        and tm.user_id = auth.uid()
    )
  );

-- ============================================================
-- tenant_members — own row or owner of same tenant can read
-- ============================================================
alter table tenant_members enable row level security;

create policy "tenant_members_select" on tenant_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from tenant_members tm
      where tm.tenant_id = tenant_members.tenant_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

-- insert/update/delete on tenant_members managed via service-role only (no user policies)

-- ============================================================
-- pipeline_stages — read: any member; write: owner only
-- ============================================================
alter table pipeline_stages enable row level security;

create policy "pipeline_stages_select" on pipeline_stages
  for select using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = pipeline_stages.tenant_id
        and tm.user_id = auth.uid()
    )
  );

create policy "owner_only_pipeline_stages_insert" on pipeline_stages
  for insert with check (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = pipeline_stages.tenant_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

create policy "owner_only_pipeline_stages_update" on pipeline_stages
  for update using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = pipeline_stages.tenant_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

create policy "owner_only_pipeline_stages_delete" on pipeline_stages
  for delete using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = pipeline_stages.tenant_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

-- ============================================================
-- leads — read/insert/update: any member; delete: owner only
-- ============================================================
alter table leads enable row level security;

create policy "leads_select" on leads
  for select using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = leads.tenant_id
        and tm.user_id = auth.uid()
    )
  );

create policy "leads_insert" on leads
  for insert with check (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = leads.tenant_id
        and tm.user_id = auth.uid()
    )
  );

create policy "leads_update" on leads
  for update using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = leads.tenant_id
        and tm.user_id = auth.uid()
    )
  );

create policy "owner_only_leads_delete" on leads
  for delete using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = leads.tenant_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

-- ============================================================
-- conversations — read/insert/update: any member
-- ============================================================
alter table conversations enable row level security;

create policy "conversations_select" on conversations
  for select using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = conversations.tenant_id
        and tm.user_id = auth.uid()
    )
  );

create policy "conversations_insert" on conversations
  for insert with check (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = conversations.tenant_id
        and tm.user_id = auth.uid()
    )
  );

create policy "conversations_update" on conversations
  for update using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = conversations.tenant_id
        and tm.user_id = auth.uid()
    )
  );

-- ============================================================
-- messages — read/insert/update: any member
-- ============================================================
alter table messages enable row level security;

create policy "messages_select" on messages
  for select using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = messages.tenant_id
        and tm.user_id = auth.uid()
    )
  );

create policy "messages_insert" on messages
  for insert with check (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = messages.tenant_id
        and tm.user_id = auth.uid()
    )
  );

create policy "messages_update" on messages
  for update using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = messages.tenant_id
        and tm.user_id = auth.uid()
    )
  );

-- ============================================================
-- stage_transitions — read: any member; insert via server only
-- ============================================================
alter table stage_transitions enable row level security;

create policy "stage_transitions_select" on stage_transitions
  for select using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = stage_transitions.tenant_id
        and tm.user_id = auth.uid()
    )
  );

-- ============================================================
-- whatsapp_sessions — NO user-accessible policies (service-role only)
-- ============================================================
alter table whatsapp_sessions enable row level security;
-- Intentionally no policies: authenticated users access state via whatsapp_sessions_public view (005__views.sql)
