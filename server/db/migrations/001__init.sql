-- 001__init.sql — Extensions, tables, FKs, indexes

create extension if not exists pgcrypto;

-- ============================================================
-- tenants
-- ============================================================
create table tenants (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- tenant_members
-- ============================================================
create table tenant_members (
  tenant_id  uuid        not null references tenants(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  role       text        not null check (role in ('owner', 'agent')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- ============================================================
-- pipeline_stages  (before leads — leads.stage_id FK)
-- ============================================================
create table pipeline_stages (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        uuid        not null references tenants(id) on delete cascade,
  name             text        not null,
  "order"          int         not null,
  is_default_entry bool        not null default false,
  created_at       timestamptz not null default now(),
  unique (tenant_id, "order")
);

-- ============================================================
-- leads
-- ============================================================
create table leads (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references tenants(id) on delete cascade,
  phone_number text        not null,
  display_name text,
  stage_id     uuid        not null references pipeline_stages(id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, phone_number)
);

-- ============================================================
-- conversations  (1:1 with lead)
-- ============================================================
create table conversations (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references tenants(id) on delete cascade,
  lead_id         uuid        not null unique references leads(id) on delete cascade,
  last_message_at timestamptz not null,
  unread_count    int         not null default 0,
  created_at      timestamptz not null default now()
);

-- inbox ordering index
create index conversations_inbox_idx on conversations (tenant_id, last_message_at desc);

-- ============================================================
-- messages
-- ============================================================
create table messages (
  id                  uuid        primary key default gen_random_uuid(),
  tenant_id           uuid        not null references tenants(id) on delete cascade,
  conversation_id     uuid        not null references conversations(id) on delete cascade,
  direction           text        not null check (direction in ('inbound', 'outbound')),
  content_type        text        not null check (content_type in ('text', 'unsupported')),
  text                text,
  whatsapp_message_id text,
  sent_by_user_id     uuid        references auth.users(id),
  status              text        check (status in ('pending', 'sent', 'delivered', 'read', 'failed')),
  error               text,
  created_at          timestamptz not null default now(),
  read_at             timestamptz
);

create index messages_conversation_idx on messages (conversation_id, created_at);

-- partial unique index for idempotent ingest (NULL whatsapp_message_id rows are excluded)
create unique index messages_wa_id_dedup_idx
  on messages (tenant_id, whatsapp_message_id)
  where whatsapp_message_id is not null;

-- ============================================================
-- stage_transitions  (audit log)
-- ============================================================
create table stage_transitions (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        uuid        not null references tenants(id) on delete cascade,
  lead_id          uuid        not null references leads(id) on delete cascade,
  from_stage_id    uuid        references pipeline_stages(id) on delete set null,
  to_stage_id      uuid        references pipeline_stages(id) on delete set null,
  moved_by_user_id uuid        references auth.users(id),
  created_at       timestamptz not null default now()
);

create index stage_transitions_lead_idx on stage_transitions (lead_id, created_at desc);

-- ============================================================
-- whatsapp_sessions  (service-role only; one row per tenant)
-- ============================================================
create table whatsapp_sessions (
  tenant_id             uuid        primary key references tenants(id) on delete cascade,
  uazapi_instance_id    text,
  uazapi_instance_token text,
  uazapi_webhook_secret text        unique,
  phone_number          text,
  status                text        not null default 'disconnected'
                                    check (status in ('disconnected', 'qr_pending', 'connecting', 'connected', 'error')),
  last_heartbeat_at     timestamptz,
  last_error            text,
  updated_at            timestamptz not null default now()
);
