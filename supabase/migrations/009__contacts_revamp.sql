-- 009__contacts_revamp.sql — Extend custom field types and backfill default marketing fields

-- 1. Extend CHECK constraint on lead_custom_fields.type
alter table lead_custom_fields
  drop constraint if exists lead_custom_fields_type_check;

alter table lead_custom_fields
  add constraint lead_custom_fields_type_check
  check (type in ('text', 'number', 'date', 'select', 'url', 'email', 'phone', 'instagram', 'checkbox'));

-- 2. Idempotently backfill default custom fields for existing tenants.
--    Order is appended after each tenant's existing max("order") to avoid
--    colliding with the unique (tenant_id, "order") constraint.
insert into lead_custom_fields (id, tenant_id, key, label, type, options, "order", created_at)
select
  gen_random_uuid(),
  t.id as tenant_id,
  d.key,
  d.label,
  d.type,
  null as options,
  coalesce(mx.max_order, -1) + d.rel_order,
  now() as created_at
from tenants t
left join lateral (
  select max("order") as max_order
  from lead_custom_fields
  where tenant_id = t.id
) mx on true
cross join lateral (values
  ('email', 'Email', 'email', 1),
  ('instagram', 'Instagram', 'instagram', 2),
  ('appointmentDate', 'Data do compromisso', 'date', 3)
) as d(key, label, type, rel_order)
where not exists (
  select 1 from lead_custom_fields lcf
  where lcf.tenant_id = t.id and lcf.key = d.key
);
