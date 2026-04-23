# Data Model — WhatsApp CRM Core

Schema relacional a ser criado em Supabase (Postgres). Todos os nomes de tabela no singular ou plural conforme convenção Supabase (lowercase, snake_case, plural onde fizer sentido). `uuid` como chave primária default, `gen_random_uuid()` via `pgcrypto`.

Todas as tabelas tenant-scoped têm coluna `tenant_id uuid not null` e têm RLS activada. Policies-tipo descritas abaixo.

---

## Tabelas

### `tenants`

Representa uma empresa-cliente da agência.

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `name` | `text` | not null |
| `created_at` | `timestamptz` | not null, default `now()` |

RLS: só utilizadores com `tenant_members.tenant_id = tenants.id` podem ler a sua própria row. Service-role escreve.

---

### `tenant_members`

Liga `auth.users` (Supabase Auth) a um tenant com um papel.

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `tenant_id` | `uuid` | FK → `tenants.id`, on delete cascade |
| `user_id` | `uuid` | FK → `auth.users.id`, on delete cascade |
| `role` | `text` | not null, check `role in ('owner', 'agent')` |
| `created_at` | `timestamptz` | default `now()` |

PK composta `(tenant_id, user_id)`. Invariante: para cada `tenant_id`, ≥1 linha com `role = 'owner'` (validado em endpoint de remoção/demoção, não via constraint SQL).

RLS:

- `select`: `auth.uid() = user_id` ou (`exists tenant_members tm2 where tm2.tenant_id = tenant_members.tenant_id and tm2.user_id = auth.uid() and tm2.role = 'owner')`.
- `insert/update/delete`: só owners do mesmo tenant, via endpoint do server (service-role).

---

### `whatsapp_sessions`

Metadados da instância uazapi por tenant. As credenciais/chaves do WhatsApp vivem dentro da uazapi, **não** aqui.

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `tenant_id` | `uuid` | PK, FK → `tenants.id`, on delete cascade |
| `uazapi_instance_id` | `text` | nullable — `instance.id` devolvido por `POST /instance/create` |
| `uazapi_instance_token` | `text` | nullable — token por instância devolvido pela uazapi; usado como header `token` em todas as chamadas desse tenant |
| `uazapi_webhook_secret` | `text` | nullable — segredo random per-tenant embebido no URL do webhook público (`/api/webhooks/uazapi/:webhookSecret`) |
| `phone_number` | `text` | nullable (só conhecido após emparelhar) |
| `status` | `text` | not null, check `status in ('disconnected','qr_pending','connecting','connected','error')` |
| `last_heartbeat_at` | `timestamptz` | nullable |
| `last_error` | `text` | nullable |
| `updated_at` | `timestamptz` | default `now()` |

Índices:

- UNIQUE `(uazapi_webhook_secret)` — lookup O(1) no endpoint de webhook, rejeita colisões logicamente impossíveis (UUID) mas defende a invariante.

RLS:

- Sem policies de `select`/`update`/`insert`/`delete` para utilizadores finais — a tabela é service-role-only.
- Para o client consumir o estado da ligação, expomos uma **view** `whatsapp_sessions_public` com apenas `(tenant_id, status, phone_number, last_heartbeat_at, last_error)` (sem o `uazapi_instance_token` nem o `uazapi_webhook_secret`). A view tem RLS a permitir leitura a membros do tenant. Supabase Realtime subscrito sobre esta view.

---

### `leads`

Pessoa que contactou o tenant por WhatsApp.

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `tenant_id` | `uuid` | FK → `tenants.id`, on delete cascade |
| `phone_number` | `text` | not null — E.164 |
| `display_name` | `text` | nullable (nome de perfil do WhatsApp quando disponível) |
| `stage_id` | `uuid` | FK → `pipeline_stages.id`, on delete restrict |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

UNIQUE `(tenant_id, phone_number)` — deduplicação (FR-007).

RLS: `select/insert/update/delete` para membros do tenant (`tenant_members.tenant_id = leads.tenant_id and user_id = auth.uid()`). Deleção via endpoint só permitida a `owner`.

---

### `conversations`

Histórico entre um lead e o tenant (1:1 com lead).

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `tenant_id` | `uuid` | FK → `tenants.id` |
| `lead_id` | `uuid` | FK → `leads.id`, on delete cascade, UNIQUE |
| `last_message_at` | `timestamptz` | not null |
| `unread_count` | `int` | not null, default 0 |
| `created_at` | `timestamptz` | default `now()` |

Index: `(tenant_id, last_message_at desc)` para o inbox ordenado (FR-006).

RLS: membros do tenant. Realtime activo nesta tabela para clients subscreverem.

---

### `messages`

Mensagem individual numa conversa.

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `tenant_id` | `uuid` | FK → `tenants.id` |
| `conversation_id` | `uuid` | FK → `conversations.id`, on delete cascade |
| `direction` | `text` | check `direction in ('inbound','outbound')` |
| `content_type` | `text` | check `content_type in ('text','unsupported')` |
| `text` | `text` | nullable (not null quando `content_type='text'`) |
| `whatsapp_message_id` | `text` | nullable — id da mensagem no WhatsApp (devolvido pela uazapi em `/send/text` e nos webhooks) para correlação e idempotência |
| `sent_by_user_id` | `uuid` | nullable; FK → `auth.users.id`; not null quando `direction='outbound'` |
| `status` | `text` | check `status in ('pending','sent','delivered','read','failed')`, aplicável só a outbound |
| `error` | `text` | nullable |
| `created_at` | `timestamptz` | default `now()` |
| `read_at` | `timestamptz` | nullable |

Index: `(conversation_id, created_at)`.

Trigger (server-side via função Postgres ou no código do adapter): ao inserir uma `message` inbound, incrementar `conversations.unread_count` e actualizar `last_message_at`; ao inserir outbound, só actualizar `last_message_at`.

RLS: membros do tenant (`select/insert/update`). Realtime activo.

---

### `pipeline_stages`

Etapa do funil de um tenant.

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `tenant_id` | `uuid` | FK → `tenants.id`, on delete cascade |
| `name` | `text` | not null |
| `order` | `int` | not null |
| `is_default_entry` | `bool` | not null, default `false` — marca a etapa onde novos leads aterram (FR-018) |
| `created_at` | `timestamptz` | default `now()` |

Constraint: exactamente uma linha com `is_default_entry = true` por tenant (validado em trigger ou em endpoint).

UNIQUE `(tenant_id, order)` para manter ordenação sem conflito.

RLS: `select` para membros do tenant; `insert/update/delete` só para `owner`.

Seed: ao criar um tenant, criar automaticamente 5 etapas por omissão:
`Novo` (order=1, is_default_entry=true), `Em conversa` (2), `Proposta` (3), `Ganho` (4), `Perdido` (5).

---

### `stage_transitions`

Log de mudanças de etapa (FR-020).

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `tenant_id` | `uuid` | FK → `tenants.id` |
| `lead_id` | `uuid` | FK → `leads.id`, on delete cascade |
| `from_stage_id` | `uuid` | FK → `pipeline_stages.id`, on delete set null (histórico pode ficar órfão de uma etapa removida) |
| `to_stage_id` | `uuid` | FK → `pipeline_stages.id`, on delete set null |
| `moved_by_user_id` | `uuid` | FK → `auth.users.id`, nullable (pode ser automático quando novo lead cai na default) |
| `created_at` | `timestamptz` | default `now()` |

Index: `(lead_id, created_at desc)` para histórico rápido por lead.

RLS: `select` para membros do tenant; `insert` via endpoint server-side.

---

## Regras de integridade cross-tabela

- Apagar um `pipeline_stage` com `leads` apontando para ele: endpoint server exige `to_stage_id` e move os leads antes de apagar. SQL permite, mas o fluxo de UI não.
- Apagar um `tenant`: cascade em tudo (útil em testes; em produção tipicamente não se apaga tenant).
- `leads.stage_id` tem `on delete restrict` para evitar orfanização silenciosa.
- Dedupe de inbound: o adapter WhatsApp verifica (ou faz `insert ... on conflict (whatsapp_message_id) do nothing` — sim, vamos adicionar UNIQUE constraint parcial em `messages(tenant_id, whatsapp_message_id)` onde `whatsapp_message_id is not null`).

## Triggers / funções auxiliares

1. **`bump_conversation_on_message`** (after insert on `messages`):
   - Actualiza `conversations.last_message_at` para `NEW.created_at`.
   - Se `direction = 'inbound'`, incrementa `unread_count`.
2. **`seed_default_pipeline_for_tenant`** (after insert on `tenants`):
   - Cria as 5 etapas por omissão descritas em `pipeline_stages`.
3. **`enforce_single_default_entry`** (before insert/update on `pipeline_stages`):
   - Se `is_default_entry = true`, garante que nenhuma outra linha do mesmo tenant também tem a flag.

## RLS — convenção

Todas as policies usam este padrão (ilustrado para `leads`):

```sql
create policy "tenant_members_select" on leads
  for select using (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = leads.tenant_id
        and tm.user_id = auth.uid()
    )
  );
```

Owner-only mutations:

```sql
create policy "owner_only_pipeline_mutations" on pipeline_stages
  for insert with check (
    exists (
      select 1 from tenant_members tm
      where tm.tenant_id = pipeline_stages.tenant_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );
-- (idem para update/delete)
```

## Realtime

Habilitar Supabase Realtime nas tabelas `conversations` e `messages`. Clients subscrevem com filtro `tenant_id=eq.<current_tenant>`. RLS garante que o canal só entrega eventos do próprio tenant mesmo que o filtro seja omitido.

## Migrações

Arquivos SQL em `server/db/migrations/` numerados `NNN__description.sql`:

- `001__init.sql` — extensions (`pgcrypto`), tabelas, FKs, índices, triggers.
- `002__rls.sql` — enable RLS + policies.
- `003__seed_defaults.sql` — função + trigger para seed das etapas por omissão.

As migrações são corridas via Supabase CLI/dashboard; não há runner próprio no server.
