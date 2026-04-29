-- 006__pipeline_custom_fields.sql — Pipeline stage colors/descriptions + lead custom fields

-- ============================================================
-- Extend pipeline_stages with color and description
-- ============================================================
alter table pipeline_stages
  add column if not exists color text not null default '#64748b',
  add column if not exists description text;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pipeline_stages_color_chk'
  ) then
    alter table pipeline_stages
      add constraint pipeline_stages_color_chk
        check (color ~ '^#[0-9a-fA-F]{6}$');
  end if;
end $$;

-- ============================================================
-- Custom field definitions per tenant
-- ============================================================
create table if not exists lead_custom_fields (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  uuid        not null references tenants(id) on delete cascade,
  key        text        not null,
  label      text        not null,
  type       text        not null check (type in ('text', 'number', 'date', 'select', 'url')),
  options    jsonb,
  "order"    int         not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, key),
  unique (tenant_id, "order")
);

-- ============================================================
-- Custom field values per lead
-- ============================================================
create table if not exists lead_custom_values (
  lead_id      uuid    not null references leads(id) on delete cascade,
  field_id     uuid    not null references lead_custom_fields(id) on delete cascade,
  value_text   text,
  value_number numeric,
  value_date   date,
  primary key (lead_id, field_id)
);

-- ============================================================
-- RLS — lead_custom_fields
-- ============================================================
alter table lead_custom_fields enable row level security;

drop policy if exists "lead_custom_fields_select" on lead_custom_fields;
create policy "lead_custom_fields_select" on lead_custom_fields
  for select using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = lead_custom_fields.tenant_id
        and tm.user_id = auth.uid()
    )
  );

drop policy if exists "owner_only_lead_custom_fields_insert" on lead_custom_fields;
create policy "owner_only_lead_custom_fields_insert" on lead_custom_fields
  for insert with check (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = lead_custom_fields.tenant_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

drop policy if exists "owner_only_lead_custom_fields_update" on lead_custom_fields;
create policy "owner_only_lead_custom_fields_update" on lead_custom_fields
  for update using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = lead_custom_fields.tenant_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

drop policy if exists "owner_only_lead_custom_fields_delete" on lead_custom_fields;
create policy "owner_only_lead_custom_fields_delete" on lead_custom_fields
  for delete using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = lead_custom_fields.tenant_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

-- ============================================================
-- RLS — lead_custom_values
-- ============================================================
alter table lead_custom_values enable row level security;

drop policy if exists "lead_custom_values_select" on lead_custom_values;
create policy "lead_custom_values_select" on lead_custom_values
  for select using (
    exists (
      select 1 from leads l
      join tenant_members tm on tm.tenant_id = l.tenant_id
      where l.id = lead_custom_values.lead_id
        and tm.user_id = auth.uid()
    )
  );

drop policy if exists "lead_custom_values_insert" on lead_custom_values;
create policy "lead_custom_values_insert" on lead_custom_values
  for insert with check (
    exists (
      select 1 from leads l
      join tenant_members tm on tm.tenant_id = l.tenant_id
      where l.id = lead_custom_values.lead_id
        and tm.user_id = auth.uid()
    )
  );

drop policy if exists "lead_custom_values_update" on lead_custom_values;
create policy "lead_custom_values_update" on lead_custom_values
  for update using (
    exists (
      select 1 from leads l
      join tenant_members tm on tm.tenant_id = l.tenant_id
      where l.id = lead_custom_values.lead_id
        and tm.user_id = auth.uid()
    )
  );

drop policy if exists "lead_custom_values_delete" on lead_custom_values;
create policy "lead_custom_values_delete" on lead_custom_values
  for delete using (
    exists (
      select 1 from leads l
      join tenant_members tm on tm.tenant_id = l.tenant_id
      where l.id = lead_custom_values.lead_id
        and tm.user_id = auth.uid()
    )
  );
