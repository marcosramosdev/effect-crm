-- 006__whatsapp_instance_meta.sql — Add whatsapp instance metadata

alter table whatsapp_sessions
  add column instance_name text,
  add column qr_expires_at timestamptz;

update whatsapp_sessions
set instance_name = tenants.name
from tenants
where tenants.id = whatsapp_sessions.tenant_id
  and whatsapp_sessions.instance_name is null;
