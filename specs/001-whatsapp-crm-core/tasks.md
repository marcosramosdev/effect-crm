---
description: "Task list for WhatsApp CRM Core (feature 001)"
---

# Tasks: WhatsApp CRM Core (Inbox, Resposta, Pipeline, Conexão)

**Input**: Design documents from `/specs/001-whatsapp-crm-core/`
**Prerequisites**: `plan.md` ✓, `spec.md` ✓, `research.md` ✓, `data-model.md` ✓, `contracts/*` (incl. `test-strategy.md`) ✓

**Tests**: TDD mandatório por decisão do `plan.md` → "Development Approach (TDD)" e `research.md` → R-012. Cada task de implementação tem uma task **Red** antecedente que cria o teste falhando; a task de implementação leva-o a verde. IDs de testes (`T-S-xxx`, `T-C-xxx`) referem-se a [`contracts/test-strategy.md`](./contracts/test-strategy.md).

**Organization**: agrupado por user story (US1 a US5) para permitir entrega incremental. US1/US2/US3 formam a **MVP (todas P1)**; US4/US5 completam o produto.

**Open items (per plan)** — estas decisões estão assumidas mas não confirmadas formalmente. Se o utilizador contradisser, várias tasks precisam de revisão:

1. Papéis `owner` / `agent` (afecta T035, T049, T059, T063, T065).
2. Rate limit 20/min + 1000/dia (afecta T044).
3. Owner pode apagar lead (afecta T068).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode correr em paralelo (ficheiro diferente, sem dependências de tasks incompletas).
- **[Story]**: a que user story pertence (`US1`..`US5`). Tasks das fases Setup/Foundational/Polish NÃO têm etiqueta de story.
- Cada task descreve ficheiro exacto + tipo de acção (Red/Green/Refactor/Infra).

## Path Conventions

- Server: raiz do repo (`server/*`, package.json na root).
- Client: `client/` (tem o seu próprio package.json).
- Shared types: `server/types/` (consumido pelo client via alias `@shared/*`).

---

## Phase 1: Setup — scaffolding + dependências

**Purpose**: preparar o terreno de desenvolvimento. Nada específico de user story; nada executável até Phase 2 terminar.

- [x] T001 Instalar dependências do server (`bun add @supabase/supabase-js zod @hono/zod-validator` na root do repo). Confirmar `package.json` actualizado e `bun.lock` consistente.
- [x] T002 [P] Instalar dependências novas do client (`cd client && bun add @supabase/supabase-js @hookform/resolvers msw`). Confirmar `client/package.json` + lockfile.
- [x] T003 Configurar shared types alias no client: adicionar `"@shared/*": ["../server/types/*"]` em `client/tsconfig.json` → `compilerOptions.paths`; estender `include` para incluir `"../server/types/**/*.ts"`; adicionar `'@shared': path.resolve(__dirname, '../server/types')` em `client/vite.config.ts` → `resolve.alias`. Validar que `import type {} from '@shared/...'` resolve em `bun --bun tsc --noEmit`.
- [x] T004 [P] Configurar Vite dev proxy `/api` → `http://localhost:3000` em `client/vite.config.ts` → `server.proxy`.
- [x] T005 [P] Criar `server/test/fixtures/jwts.ts` — helper `makeTestJwt({ userId, tenantId, role })` que assina HS256 com `SUPABASE_JWT_SECRET=test-secret` (via `jose` nativo ou `bun.crypto`).
- [x] T006 [P] Criar `server/test/fixtures/supabase.ts` — factory `makeSupabaseMock({ rows, role })` que devolve um objecto encadeável imitando `from().select().eq().single()` e `insert`/`update`/`delete`. Sem dependências externas (implementação inline).
- [x] T007 [P] Criar `client/src/test/setup.ts` — Vitest global setup: `import '@testing-library/jest-dom'`; mock de `window.matchMedia`; inicializa MSW server. Referenciar em `client/vitest.config` ou `client/vite.config.ts` (`test.setupFiles`).
- [x] T008 [P] Criar `client/src/test/msw/server.ts` + `client/src/test/msw/handlers.ts` — handler MSW base para `GET /api/auth/me`, com utility `overrideHandler()` para testes individuais.
- [x] T009 [P] Criar `server/lib/whatsapp/__fixtures__/uazapi-events.ts` — exportar payloads fixture para eventos `messages` (texto), `messages` (unsupported), `messages_update` (cada status), `connection` (cada estado). Basear em exemplos do `uazapi-openapi-spec.yaml`.
- [x] T010 [P] Adicionar scripts de teste ao `package.json` root: `"test": "bun test"`, `"test:watch": "bun test --watch"`. Cliente já tem Vitest configurado.

**Checkpoint 1**: `bun test` e `cd client && bun --bun run test` correm (sem testes ainda) sem erro.

---

## Phase 2: Foundational — base blocking para todas as user stories

**Purpose**: infraestrutura transversal que qualquer US precisa. NENHUMA US pode começar até isto estar pronto.

**⚠️ CRITICAL**: user stories bloqueiam até esta fase acabar.

### Database + RLS

- [x] T011 Criar `server/db/migrations/001__init.sql` — `create extension pgcrypto`; tabelas `tenants`, `tenant_members`, `leads`, `conversations`, `messages`, `pipeline_stages`, `stage_transitions`, `whatsapp_sessions` conforme `data-model.md`; todos os FKs, UNIQUEs, CHECKs, índices.
- [x] T012 Criar `server/db/migrations/002__rls.sql` — enable RLS em todas as tabelas tenant-scoped; policies `tenant_members_select`, `owner_only_*` para `pipeline_stages` e `tenant_members`, zero policies em `whatsapp_sessions`. Ver data-model.md.
- [x] T013 Criar `server/db/migrations/003__seed_defaults.sql` — função `seed_default_pipeline_for_tenant()` + trigger `after insert on tenants`. Etapas default: Novo → Em conversa → Proposta → Ganho → Perdido. `Novo` com `is_default_entry=true`.
- [x] T014 Criar `server/db/migrations/004__triggers.sql` — função + trigger `bump_conversation_on_message` em `messages` (actualiza `last_message_at`, incrementa `unread_count` em inbound); função + trigger `enforce_single_default_entry` em `pipeline_stages`.
- [x] T015 Criar `server/db/migrations/005__views.sql` — view `whatsapp_sessions_public(tenant_id, status, phone_number, last_heartbeat_at, last_error)`; RLS na view permitindo select a membros do tenant.
- [x] T016 Aplicar todas as migrations 001-005 no projecto Supabase de dev via SQL editor ou Supabase CLI. Confirmar que `tenant_members` aceita apenas `role in ('owner','agent')`.

### Shared types

- [x] T017 [P] Criar `server/types/common.ts` — `TenantIdSchema = z.string().uuid()`, `UserIdSchema`, `LeadIdSchema`, `ConversationIdSchema`, `MessageIdSchema`, `StageIdSchema`, `RoleSchema = z.enum(['owner','agent'])`, `ErrorCodeSchema = z.enum([...])`, `ErrorResponseSchema = z.object({ error: z.object({ code, message, details: z.unknown().optional() }) })`. Exportar tipos via `z.infer`.
- [x] T018 [P] Criar `server/types/index.ts` — re-export de todos os submódulos (`common`, futuro `auth`, `whatsapp`, `inbox`, `pipeline`). Começa só com `common`.

### Server — DB client + middlewares + skeleton

- [x] T019 [P] Criar `server/db/client.ts` — export `createUserSupabase(jwt: string)` (usa `SUPABASE_ANON_KEY` + header `Authorization: Bearer`) e `createServiceSupabase()` (usa `SUPABASE_SERVICE_ROLE_KEY`, singleton). Ambos chamam `createClient` de `@supabase/supabase-js`. Ler env vars directamente.
- [x] T020 [P] Criar `server/middlewares/error.ts` — middleware Hono que faz `try/catch` e converte erros tipados (classes `ApiError`, `UazapiUnauthorizedError`, etc.) em JSON `{ error: { code, message, details } }` com o status HTTP correcto.
- [x] T021 **Red** Criar `server/middlewares/auth.test.ts` com testes T-S-040..043 (ver `contracts/test-strategy.md`): JWT ausente → 401; JWT inválido → 401; JWT válido mas sem membership → 403; JWT válido + membership → handler recebe `c.var.userId/tenantId/role`. Correr `bun test server/middlewares/auth.test.ts`, todos MUST fail.
- [x] T022 **Green** Implementar `server/middlewares/auth.ts` — valida JWT HS256 contra `SUPABASE_JWT_SECRET`; extrai `sub`; procura em `tenant_members` via `createServiceSupabase()` para resolver `tenant_id` + `role`; anexa a `c.var`. Correr os testes T-S-040..043 ⇒ todos green.
- [x] T023 [P] Criar `server/middlewares/tenant-guard.ts` — pequeno middleware que assert `c.var.tenantId` está presente; 500 se não. Wrapper trivial a seguir ao auth.
- [x] T024 Modificar `server/index.ts` para montar Hono app com middlewares globais (logger, error handler), grupo `/api/*` com `auth + tenantGuard`, e endpoint público `GET /health` (sem auth). Deixar comentários `// TODO: mount routes` onde as routes das user stories serão adicionadas.

### Server — utilitários de domínio partilhados

- [x] T025 [P] **Red** Criar `server/lib/whatsapp/rate-limiter.test.ts` com testes T-S-001..005. Usar `Bun.test`'s fake timers (`mock.useFakeTimers()` ou equivalente Bun). Todos MUST fail.
- [x] T026 **Green** Implementar `server/lib/whatsapp/rate-limiter.ts` — token-bucket com dois níveis (20/min, 1000/24h) por `tenantId`. Export `consume(tenantId): { ok: true } | { ok: false, retryAfterSeconds }`. Testes T-S-001..005 ⇒ green.
- [x] T027 [P] **Red** Criar `server/lib/whatsapp/uazapi-client.test.ts` com testes T-S-010..017. Usar `vi.stubGlobal('fetch', …)` ou o helper nativo de Bun para mock de `fetch`. Cada teste verifica URL, headers, body.
- [x] T028 **Green** Implementar `server/lib/whatsapp/uazapi-client.ts` — funções `createInstance`, `connect`, `disconnect`, `sendText`, `configureWebhook`. Errors tipados (`UazapiUnauthorizedError`, `UazapiRateLimitedError`, `UazapiTransientError`). Lê `UAZAPI_BASE_URL` + `UAZAPI_ADMIN_TOKEN` do env. Testes T-S-010..017 ⇒ green.
- [x] T029 [P] Criar `server/lib/whatsapp/index.ts` — interface pública do adapter: `export { createInstance, connect, disconnect, sendText, configureWebhook, consume as rateLimit, handleWebhookEvent /* stub, preenchido em US1..US3 */ }`.

### Client — infra transversal

- [x] T030 [P] Criar `client/src/lib/supabase.ts` — `createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)`; export singleton `supabase`. Configurar `auth.persistSession = true`.
- [x] T031 [P] Criar `client/src/lib/api.ts` — `async function apiFetch<T>(path, init?)` que: (a) obtém token via `supabase.auth.getSession()`; (b) adiciona `Authorization: Bearer`; (c) faz `fetch(`/api${path}`, …)`; (d) valida response com schema Zod opcional; (e) mapeia 401 → logout, 429 → erro tipado `RateLimitedError` com `retryAfter`.
- [x] T032 [P] **Red** Criar `client/src/hooks/__tests__/useAuth.test.tsx` (T-C-001). MSW intercepta `GET /api/auth/me` devolvendo user válido. Fail.
- [x] T033 **Green** Implementar `client/src/hooks/useAuth.ts` — hook com React Query que chama `apiFetch('/auth/me')`. Teste ⇒ green.
- [x] T034 [P] **Red** Criar `client/src/routes/__tests__/guard.test.tsx` (T-C-002) — simula route a `/settings/pipeline` como agent, verifica redirect. Fail.
- [x] T035 **Green** Implementar guard de rota `beforeLoad` em `/settings/pipeline` que redirecciona quando `role !== 'owner'`. Aplicar padrão a outras rotas depois.

**Checkpoint 2**: Foundational ready. `bun test` e `cd client && bun --bun run test` correm verdes com os testes acima. Server arranca via `bun run server`, devolve 200 em `/health`.

---

## Phase 3: User Story 1 (P1) — Conectar WhatsApp 🎯 MVP bloco 1

**Goal**: o utilizador consegue ligar o WhatsApp da empresa ao CRM, vê QR, emparelha, e vê o estado "conectado" persistido.

**Independent Test**: com um tenant+owner provisionados em dev, abrir `/connect` → iniciar conexão → emparelhar com telemóvel → estado aparece "conectado"; enviar mensagem de fora verifica que o evento `connection` do webhook flui.

### Types e auth endpoint

- [ ] T036 [P] [US1] Criar `server/types/auth.ts` — `MeResponseSchema = z.object({ userId, email, tenantId, tenantName, role })`. Exportar tipo.
- [ ] T037 [P] [US1] Criar `server/types/whatsapp.ts` — `ConnectionStatusSchema`, `ConnectionResponseSchema`, `StartConnectionResponseSchema`, `WebhookEventEnvelopeSchema`. Ver `contracts/whatsapp.md` + `contracts/webhooks.md`.
- [ ] T038 [US1] **Red** Criar `server/routes/auth.test.ts` — `GET /api/auth/me` com JWT válido → shape correcta; sem JWT → 401. Fail.
- [ ] T039 [US1] **Green** Implementar `server/routes/auth.ts` (`GET /me`) e montar em `/api/auth/*` em `server/index.ts`. Testes ⇒ green.

### uazapi session provisioning + webhook base

- [ ] T040 [P] [US1] **Red** Criar `server/routes/whatsapp.test.ts` com T-S-070..074. Fail.
- [ ] T041 [US1] **Green** Implementar `server/routes/whatsapp.ts` — `GET /connection`, `POST /connection` (provisiona instância na primeira vez via `uazapi.createInstance` + `configureWebhook` + `connect`), `POST /disconnect`. Guardar `uazapi_instance_id`, `uazapi_instance_token`, `uazapi_webhook_secret` (`crypto.randomUUID()`) em `whatsapp_sessions` via service-role. Montar em `/api/whatsapp/*`. Testes T-S-070..074 ⇒ green.
- [ ] T042 [P] [US1] **Red** Criar `server/routes/webhooks.test.ts` com T-S-030..033 — segredo inválido, segredo válido com mismatch de instance, segredo válido completo, log sanitization. Fail.
- [ ] T043 [US1] **Green** Implementar `server/routes/webhooks.ts` — `POST /api/webhooks/uazapi/:webhookSecret` público (sem middleware `auth`); parse do envelope com Zod; lookup do segredo em `whatsapp_sessions` via service-role (comparação timing-safe com `crypto.timingSafeEqual`); validação de `instance`; dispatch para `handleWebhookEvent` (stub por agora). Testes T-S-030..033 ⇒ green.
- [ ] T044 [P] [US1] **Red** Criar `server/lib/whatsapp/webhook-handler.test.ts` com T-S-027 (connection event). Fail.
- [ ] T045 [US1] **Green** Em `server/lib/whatsapp/webhook-handler.ts`, implementar dispatcher com ramo `event === 'connection'`: actualiza `whatsapp_sessions.status`, `phone_number`, `last_heartbeat_at` (quando `connected`), `last_error` (quando `disconnected`) via service-role. T-S-027 ⇒ green.

### Client — Connect screen

- [ ] T046 [P] [US1] **Red** Criar `client/src/features/whatsapp/__tests__/ConnectScreen.test.tsx` com T-C-010..013. MSW intercepta `/api/whatsapp/connection`; mock de `supabase.channel(...).on(...).subscribe()` para Realtime update. Fail.
- [ ] T047 [US1] **Green** Implementar `client/src/features/whatsapp/ConnectScreen.tsx` — React Query carrega estado; botão "conectar" (só owner) dispara mutation `POST /api/whatsapp/connection`; mostra QR quando `status='qr_pending'`; subscreve `whatsapp_sessions_public` para transições. Ver T-C-010..013. Green.
- [ ] T048 [P] [US1] Criar `client/src/routes/connect.tsx` — TanStack Router route que renderiza `ConnectScreen`. Proteger como owner (redireccionar agent para `/inbox`).
- [ ] T049 [US1] Criar `client/src/routes/index.tsx` — redirect condicional: se `status==='connected'` vai para `/inbox`; caso contrário `/connect`. (Role-gated: agents vão sempre para `/inbox`.)

**Checkpoint US1**: um tenant em dev consegue fazer o fluxo completo login → connect → QR → estado "conectado". Testes T-S-070..074, T-S-030..033, T-S-027, T-C-010..013 passam. MVP bloco 1 completo — demonstrável isoladamente.

---

## Phase 4: User Story 2 (P1) — Inbox unificado

**Goal**: conversas que chegam pela uazapi aparecem em tempo quasi-real num inbox centralizado com pesquisa, filtro de não-lidas, e marcação de leitura.

**Independent Test**: com WhatsApp conectado (US1), enviar mensagens de diferentes números; confirmar que o inbox em `/inbox` mostra N conversas em <5s, ordenadas por última actividade; clicar abre o histórico e zera o contador de não-lidas.

### Shared types

- [ ] T050 [P] [US2] Expandir `server/types/inbox.ts` — `ConversationSummarySchema`, `ConversationListResponseSchema` (com `nextCursor`), `ConversationDetailSchema`, `MessageSchema`, `ListConversationsQuerySchema`, `ListMessagesQuerySchema`, `MarkReadResponseSchema`. Re-export em `server/types/index.ts`.

### Webhook handler — messages event

- [ ] T051 [US2] **Red** Expandir `server/lib/whatsapp/webhook-handler.test.ts` com T-S-020..023 (messages / duplicate / unsupported / group ignored). Fail.
- [ ] T052 [US2] **Green** Em `webhook-handler.ts`, implementar ramo `event === 'messages'`:
  - extrair `phoneNumber` (strip `@s.whatsapp.net`);
  - `chatid` com `@g.us` → return silenciosamente;
  - upsert `lead` via `(tenant_id, phone_number)` — se novo, `stage_id` = default entry;
  - upsert `conversation` via `(tenant_id, lead_id)`;
  - insert `messages` com `direction='inbound'`, `content_type='text'` ou `'unsupported'`, `ON CONFLICT (tenant_id, whatsapp_message_id) DO NOTHING`.
    Testes T-S-020..023 ⇒ green.

### Inbox routes

- [ ] T053 [P] [US2] **Red** Criar `server/routes/inbox.test.ts` com T-S-055, T-S-056, T-S-054 (unreadOnly filter, search, mark-read). Fail.
- [ ] T054 [US2] **Green** Implementar `server/routes/inbox.ts` (parte de US2): `GET /conversations`, `GET /conversations/:id`, `POST /conversations/:id/read`. Montar em `/api/inbox/*`. Para GET usar `createUserSupabase(c.var.jwt)` (aproveita RLS). Para `POST /read` usar service-role para fazer a transacção. Testes T-S-054..056 ⇒ green.

### Client — Inbox UI

- [ ] T055 [P] [US2] **Red** Criar `client/src/features/inbox/__tests__/InboxList.test.tsx` com T-C-020, T-C-021, T-C-025. MSW + mock Realtime. Fail.
- [ ] T056 [US2] **Green** Implementar `client/src/features/inbox/InboxList.tsx` — lista com React Query (`/api/inbox/conversations`), click activa `POST /read`, subscreve Realtime em `conversations` e `messages` filtrado por `tenant_id` para actualização incremental. Testes T-C-020, T-C-021, T-C-025 ⇒ green.
- [ ] T057 [P] [US2] Implementar `client/src/features/inbox/ConversationView.tsx` — carrega histórico com `GET /conversations/:id`, usa React Query infinite query para paginação (`beforeCursor`). Scroll para a mensagem mais recente. Realtime para novas mensagens.
- [ ] T058 [P] [US2] Criar rotas TanStack: `client/src/routes/inbox/index.tsx` (layout + InboxList) e `client/src/routes/inbox/$conversationId.tsx` (ConversationView).

**Checkpoint US2**: uma mensagem externa entregue por webhook aparece no `/inbox` do agente em <5s. Testes US2 passam. MVP bloco 2 completo.

---

## Phase 5: User Story 3 (P1) — Responder ao lead pelo sistema

**Goal**: agente envia texto ao lead a partir da conversa; acompanha estado (pending/sent/delivered/failed); sistema bloqueia envio quando desconectado ou rate-limited.

**Independent Test**: abrir uma conversa existente no `/inbox`; escrever e enviar texto; mensagem aparece em pending e transita para sent/delivered à medida que `messages_update` chega do webhook; telemóvel externo recebe a mensagem.

### Types

- [ ] T059 [P] [US3] Adicionar a `server/types/inbox.ts` — `SendMessageRequestSchema = z.object({ text: z.string().trim().min(1).max(4096) })`, `SendMessageResponseSchema`.

### Server — send endpoint + messages_update webhook

- [ ] T060 [US3] **Red** Expandir `server/routes/inbox.test.ts` com T-S-050..053 (disconnected / rate-limited / happy path / cross-tenant 404). Fail.
- [ ] T061 [US3] **Green** Implementar `POST /api/inbox/conversations/:id/messages` em `server/routes/inbox.ts`:
  1. Validar body Zod.
  2. Verificar `rateLimit.consume(tenantId)` → 429 com `Retry-After` se falhar.
  3. Ler `whatsapp_sessions.status` via service-role → 409 `WHATSAPP_DISCONNECTED` se não `connected`.
  4. Insert `messages` com `status='pending'`, `direction='outbound'`, `sent_by_user_id = c.var.userId`.
  5. Dispatch `await uazapi.sendText({ token, number, text })`. Se retornar 429 uazapi → propagar 429 (não consumir novo token). Guardar `whatsapp_message_id` devolvido.
  6. Responder 202 com `{ message: {...} }`.
     Testes T-S-050..053 ⇒ green.
- [ ] T062 [US3] **Red** Expandir `server/lib/whatsapp/webhook-handler.test.ts` com T-S-024..026 (messages_update: SERVER_ACK/READ/mensagem-inexistente). Fail.
- [ ] T063 [US3] **Green** Em `webhook-handler.ts`, implementar ramo `event === 'messages_update'`: mapeia status uazapi → nosso (`SERVER_ACK`→`sent`, `DELIVERY_ACK`→`delivered`, `READ`→`read`+`read_at=now()`, `FAILED`→`failed`); `UPDATE messages` por `(tenant_id, whatsapp_message_id)`. Se a mensagem não existir, retornar sem erro. Testes T-S-024..026 ⇒ green.

### Client — Send form + status display

- [ ] T064 [P] [US3] **Red** Criar `client/src/features/inbox/__tests__/SendMessageForm.test.tsx` com T-C-022..024 (empty rejected / disconnected toast / rate-limit hint). Fail.
- [ ] T065 [US3] **Green** Implementar `client/src/features/inbox/SendMessageForm.tsx` — React Hook Form + `zodResolver(SendMessageRequestSchema)`; mutation React Query POST `/conversations/:id/messages`; 409 → toast "Reconecte o WhatsApp" e preservar texto; 429 → mostrar `Retry-After`; optimistic insert da mensagem pending no cache. Testes T-C-022..024 ⇒ green.
- [ ] T066 [US3] Integrar `SendMessageForm` em `ConversationView.tsx` (T057). Adicionar rendering do estado (`pending` → spinner, `delivered` → ✓✓, `read` → ✓✓ azul, `failed` → alerta + botão "tentar novamente").

**Checkpoint US3 / MVP completa**: fluxo completo de 2 vias funciona. US1+US2+US3 entregáveis como MVP. Testes T-S-050..053, T-S-024..026, T-C-022..024 passam.

---

## Phase 6: User Story 4 (P2) — Pipeline com etapas

**Goal**: vista kanban por etapas; drag-and-drop move leads entre etapas; transições persistidas e auditáveis.

**Independent Test**: com leads existentes no inbox, abrir `/pipeline`, arrastar um lead de "Novo" para "Em conversa"; refrescar verifica persistência; abrir a conversa desse lead e confirmar que a nova etapa aparece.

### Types

- [ ] T067 [P] [US4] Criar `server/types/pipeline.ts` — `PipelineStageSchema`, `StageListResponseSchema`, `LeadSchema`, `LeadListResponseSchema`, `ListLeadsQuerySchema`, `MoveLeadRequestSchema`.

### Server — pipeline read + move

- [ ] T068 [US4] **Red** Criar `server/routes/pipeline.test.ts` com T-S-065 + variantes (list stages returns default, list leads filter by stage, move lead cria transition). Fail.
- [ ] T069 [US4] **Green** Implementar `server/routes/pipeline.ts` (parcial, só P2): `GET /stages`, `GET /leads`, `PATCH /leads/:leadId/stage`. Em `PATCH`, actualizar `leads.stage_id` e inserir `stage_transitions` na mesma transacção via service-role. Montar em `/api/pipeline/*`. Testes ⇒ green.

### Client — Kanban

- [ ] T070 [P] [US4] **Red** Criar `client/src/features/pipeline/__tests__/PipelineBoard.test.tsx` com T-C-030..031 (drag dispara mutation, optimistic update). Fail.
- [ ] T071 [US4] **Green** Implementar `client/src/features/pipeline/PipelineBoard.tsx` — fetch de stages + leads; DnD nativo HTML5 (sem lib extra, Princípio V); optimistic update na mutation PATCH com rollback em erro. Testes T-C-030..031 ⇒ green.
- [ ] T072 [P] [US4] Criar rota `client/src/routes/pipeline/index.tsx` que renderiza `PipelineBoard`.

**Checkpoint US4**: pipeline usável com etapas default. US4 entregue.

---

## Phase 7: User Story 5 (P3) — Personalizar etapas

**Goal**: owner gere as etapas do pipeline (adicionar / renomear / reordenar / remover com destino).

**Independent Test**: owner renomeia uma etapa, adiciona nova, remove uma ocupada (escolhendo destino); agent vê as alterações em `/pipeline`; agent não consegue aceder às settings.

### Server — stage mutations

- [ ] T073 [US5] **Red** Expandir `server/routes/pipeline.test.ts` com T-S-060..064 (agent 403, owner cria, delete sem destino 409, delete com destino 204, delete da unica default 409). Fail.
- [ ] T074 [US5] **Green** Implementar `POST /stages`, `PATCH /stages/:id`, `DELETE /stages/:id` em `server/routes/pipeline.ts`. Middleware interno `requireOwner` (reutilizado em US5 + polish). Recalcular `order` denso após mutações. Testes T-S-060..064 ⇒ green.

### Client — Settings/pipeline

- [ ] T075 [P] [US5] **Red** Criar `client/src/features/pipeline/__tests__/StageSettings.test.tsx` com T-C-032..034 (reorder owner, remove com modal destino, agent não vê menu). Fail.
- [ ] T076 [US5] **Green** Implementar `client/src/features/pipeline/StageSettings.tsx` — lista editável com DnD para reordenar; form React Hook Form + Zod para criar/renomear; modal para remover (escolher destino quando `leadsAffected > 0`). Testes ⇒ green.
- [ ] T077 [P] [US5] Criar rota `client/src/routes/settings/pipeline.tsx` (owner-only via guard de T035).

**Checkpoint US5**: produto 100% do scope. Todos os testes verdes.

---

## Phase 8: Polish & cross-cutting

**Purpose**: extras operacionais e de produto que não estão no caminho crítico da demo mas são necessários para produção.

### Team management (auxiliar de US5; necessário para produto real)

- [ ] T078 [P] **Red** Criar `server/routes/team.test.ts` — `POST /team/invite` como owner (200 + `inviteUserByEmail` chamado + insert em `tenant_members`); como agent (403). Fail.
- [ ] T079 **Green** Implementar endpoint de team em `server/routes/pipeline.ts` (sub-árvore `/team`): `GET /team`, `POST /team/invite`, `DELETE /team/:userId`. Usar `createServiceSupabase().auth.admin.inviteUserByEmail`. Bloquear delete do último owner. Testes ⇒ green.
- [ ] T080 [P] Implementar `client/src/routes/settings/team.tsx` — lista membros, form de convite, botão remover com confirmação. Owner-only.

### Deleção de lead (owner-only, GDPR baseline per R-007)

- [ ] T081 [P] **Red** Adicionar a `server/routes/pipeline.test.ts` T-S-066..067 (agent 403, owner cascade apaga conversa+messages). Fail.
- [ ] T082 **Green** Implementar `DELETE /api/pipeline/leads/:leadId` — owner-only; cascade automática via FKs `on delete cascade`; devolve `{ deletedLeadId }`. Testes ⇒ green.

### Produção — static serving + Dockerfile

- [ ] T083 Modificar `server/index.ts` — em produção (detectar por `NODE_ENV==='production'`), servir `client/dist` como estático via `serveStatic` do Hono e adicionar catch-all que devolve `client/dist/index.html` para rotas não-`/api/*`.
- [ ] T084 Criar `Dockerfile` multi-stage conforme `quickstart.md` — stage 1 builda client (copia `server/types/` também), stage 2 é o runtime Bun com `server/` + `client/dist/`. Expor 3000.
- [ ] T085 [P] Criar `.dockerignore` — `node_modules`, `client/node_modules`, `*.log`, `.env`, `.git`.
- [ ] T086 [P] Criar `.env.example` na root com todas as env vars do quickstart — documenta sem expor segredos.

### Observabilidade mínima

- [ ] T087 [P] Adicionar logger estruturado (JSON) em `server/middlewares/error.ts` — log correlacionado com `requestId` (gerar com `crypto.randomUUID()`); sanitizar `webhookSecret` do path (regex). Princípio VI (nunca logar tokens).

### Smoke test manual

- [ ] T088 Executar o fluxo completo do "Fluxo de verificação manual" do `quickstart.md` — login, connect, enviar, receber, pipeline move, settings. Documentar quaisquer gaps encontrados em issues de follow-up.

### Limpeza final

- [ ] T089 [P] Correr `cd client && bun --bun run check` e `bun --bun tsc --noEmit -p tsconfig.json` na root. Zero errors.
- [ ] T090 [P] Correr todos os testes uma última vez em verde: `bun test` + `cd client && bun --bun run test`.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: sem dependências; pode começar já.
- **Phase 2 (Foundational)**: depende do setup. **BLOCKS** todas as user stories.
- **Phase 3 (US1)**: depende de Phase 2.
- **Phase 4 (US2)**: depende de Phase 2 **E** de Phase 3 (webhook route + connection handler; se US2 precisar de mensagens chegarem, precisa do webhook operacional com provisionamento de instância feito em US1). Na prática: US2 arranca a seguir a US1.
- **Phase 5 (US3)**: depende de Phase 2, 3 e 4 (send precisa de conversa existente; messages_update estende o webhook handler de US2).
- **Phase 6 (US4)**: depende de Phase 2 + Phase 4 (precisa de leads existirem, criados pelo webhook em US2).
- **Phase 7 (US5)**: depende de Phase 2 + Phase 6 (altera etapas que o kanban de US4 renderiza).
- **Phase 8 (Polish)**: depende de tudo anterior.

### Within each user story

- Tests FIRST (Red) — criar teste, verificar que falha.
- Implementation depois (Green) — mínimo para passar.
- Refactor se necessário, mantendo verde.
- Models/types antes de services.
- Services antes de endpoints HTTP.
- Endpoints antes de componentes client.

### Parallel opportunities

- Em **Phase 1**: T002, T004, T005, T006, T007, T008, T009, T010 podem correr paralelas após T001.
- Em **Phase 2**: migrations (T011–T015) são sequenciais mas migrations + types + middlewares+utilities+client infra são grupos paralelos; T017/T018 paralelos a T019/T020; T025/T027 paralelos a T030/T031.
- Em cada US: as tasks marcadas `[P]` (red tests, types, rotas TanStack do client) podem correr paralelas; as impls Green são sequenciais dentro do grupo porque dependem dos seus testes Red.

### Parallel example — Foundational (após T016 aplicar migrations)

```bash
# Em terminais separados / workers:
Task: T017  Criar server/types/common.ts
Task: T019  Criar server/db/client.ts
Task: T020  Criar server/middlewares/error.ts
Task: T025  Red: rate-limiter.test.ts
Task: T027  Red: uazapi-client.test.ts
Task: T030  Criar client/src/lib/supabase.ts
Task: T031  Criar client/src/lib/api.ts
```

Depois de T025 / T027 / T032 / T034 passarem Red, avança-se às respectivas Green em sequência no mesmo worker.

---

## Implementation Strategy

### MVP First (US1 + US2 + US3, todas P1)

1. Terminar Phases 1 + 2 (Setup + Foundational).
2. US1 — conectar WhatsApp. **Demo parcial**: mostrar que o tenant consegue emparelhar e ver estado conectado.
3. US2 — inbox. **Demo**: mensagens chegam em tempo quasi-real.
4. US3 — resposta. **Demo MVP completa**: resposta bidireccional funciona.
5. **STOP + VALIDATE**: smoke test manual end-to-end, pedir feedback ao stakeholder.

### Incremental delivery

- MVP entregue após US3 → deploy staging → utilizador piloto testa.
- US4 adiciona pipeline visual (diferencial contra "apenas WhatsApp") → deploy incremental.
- US5 adiciona personalização → entrega multi-tenancy completa.
- Polish fecha com Dockerfile, team mgmt, e delete-lead para produção real.

### Riscos conhecidos (follow-up antes de produção)

- **uazapi `free`** cai após 1h — só para dev. Staging/prod exige `api.uazapi.com` ou subdomain contratado (R-011).
- **Open items não confirmados** (roles, rate limit, delete lead) — se o utilizador mudar as decisões após T035/T044/T082 estarem implementados, há retrabalho. Confirmar antes de arrancar Phase 3.
- **E2E tests** ficam de fora da MVP (R-012). Adicionar Playwright em sprint pós-MVP se o utilizador pedir.

---

## Notes

- Tasks sem `[P]` têm dependência directa na task anterior na mesma fase (tipicamente Red → Green).
- Commits: um por task ou por par Red+Green. Mensagem descreve o comportamento, não o mecanismo.
- Qualquer teste `it.skip()` ou `it.only()` no diff antes de marcar task ✅ é merge-blocker (`plan.md` → Development Approach → Definition of Done).
- Actualizar `CLAUDE.md` (root) com notas novas apenas se descobrirmos padrões que **contradizem** o plano — caso contrário, o plano já é a source of truth.
- Testes com IDs `T-S-xxx` / `T-C-xxx` estão catalogados em `contracts/test-strategy.md` com o comportamento exacto a asserçionar.
