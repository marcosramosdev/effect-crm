# Test Strategy — WhatsApp CRM Core

Inventário de testes por camada, com IDs para rastreabilidade em `tasks.md`. Cada teste listado corresponde a um comportamento concreto que o código MUST garantir. Os IDs (`T-S-xxx` = server test; `T-C-xxx` = client test) são referenciados nas tasks e nos DoDs.

**Runners**: `bun test` no server, Vitest no client.
**Convenção**: ficheiros `*.test.ts(x)` colocalizados com o código que testam.

---

## Server — Unit tests

### `server/lib/whatsapp/rate-limiter.test.ts`

| ID | Descrição | Tipo de asserção |
| --- | --- | --- |
| T-S-001 | Bucket emite tokens até ao limite configurado | espera sucesso N vezes, 429 na N+1 |
| T-S-002 | Tokens refrescam à taxa esperada (20/min = ~1 token a cada 3s) | fake timers + avanço explícito |
| T-S-003 | Buckets de tenants diferentes são independentes | dois tenants, consumo cruzado não afecta |
| T-S-004 | Limite diário corta mesmo quando o por-minuto tem tokens | cenário com 1000 msg em < 24h |
| T-S-005 | `Retry-After` devolvido em segundos corresponde ao próximo refresh | unidade consistente com contracto |

### `server/lib/whatsapp/uazapi-client.test.ts`

| ID | Descrição | Tipo de asserção |
| --- | --- | --- |
| T-S-010 | `createInstance()` envia `POST /instance/create` com header `admintoken` correcto | fetch mock recebe request esperada |
| T-S-011 | `createInstance()` retorna `{ instanceId, token }` a partir de resposta 200 | parsing correcto |
| T-S-012 | `connect()` envia `POST /instance/connect` com header `token` (instance-scoped) e body vazio | fetch mock |
| T-S-013 | `sendText({ number, text })` monta `POST /send/text` com body correcto | fetch mock |
| T-S-014 | `configureWebhook({ url, events, excludeMessages })` envia `POST /webhook` | fetch mock |
| T-S-015 | 401 da uazapi propaga como `UazapiUnauthorizedError` tipado | error assertion |
| T-S-016 | 429 da uazapi propaga como `UazapiRateLimitedError` com `retryAfter` (se header presente) | error assertion |
| T-S-017 | 5xx da uazapi propaga como `UazapiTransientError` | error assertion |

### `server/lib/whatsapp/webhook-handler.test.ts`

| ID | Descrição | Tipo de asserção |
| --- | --- | --- |
| T-S-020 | Payload `messages` de texto cria `lead`, `conversation`, `message` inbound | Supabase mock recebe inserts com shape correcto |
| T-S-021 | Segundo envio do mesmo `id` não cria duplicados (idempotência via on-conflict) | mock retorna 0 rows affected no segundo; sem throw |
| T-S-022 | Payload `messages` de tipo não suportado (imagem/áudio) insere com `content_type='unsupported'` e `text=null` | mock assertion |
| T-S-023 | Payload `messages` de grupo (`chatid` com `@g.us`) é ignorado sem erro | mock não recebe insert |
| T-S-024 | Payload `messages_update` → `UPDATE messages SET status='sent'` para SERVER_ACK | mock assertion |
| T-S-025 | Payload `messages_update` com `READ` actualiza `status` e `read_at` | mock assertion |
| T-S-026 | Payload `messages_update` de mensagem inexistente não lança (ignora) | silent pass |
| T-S-027 | Payload `connection` com `state='connected'` actualiza `whatsapp_sessions.status` + `last_heartbeat_at` | mock assertion |

### `server/routes/webhooks.test.ts` (route/integration)

| ID | Descrição | Tipo de asserção |
| --- | --- | --- |
| T-S-030 | Segredo inválido → 401 | `app.request()` |
| T-S-031 | Segredo válido mas `envelope.instance` de outro tenant → 400 `INSTANCE_MISMATCH` | `app.request()` |
| T-S-032 | Segredo válido + payload válido → 200 + side-effects no Supabase mock | `app.request()` |
| T-S-033 | Logger do request sanitiza o segredo do path (nunca aparece nos logs) | spy no logger |

### `server/middlewares/auth.test.ts`

| ID | Descrição | Tipo de asserção |
| --- | --- | --- |
| T-S-040 | JWT ausente → 401 | `app.request()` sem header |
| T-S-041 | JWT inválido (assinatura) → 401 | JWT assinado com secret errado |
| T-S-042 | JWT válido mas user sem `tenant_members` → 403 | `app.request()` + supabase mock |
| T-S-043 | JWT válido + membership → handler recebe `c.var.userId`, `c.var.tenantId`, `c.var.role` correctos | downstream handler trivial confirma |

### `server/routes/inbox.test.ts`

| ID | Descrição | Tipo de asserção |
| --- | --- | --- |
| T-S-050 | `POST /conversations/:id/messages` com sessão desconectada → 409 `WHATSAPP_DISCONNECTED` | mock `whatsapp_sessions.status='disconnected'` |
| T-S-051 | `POST /conversations/:id/messages` excedeu rate limit → 429 + header `Retry-After` | rate-limiter mock retorna empty |
| T-S-052 | `POST /conversations/:id/messages` caso feliz → 202 + chamada a `uazapi.sendText` + insert `messages` com `status='pending'` | mocks |
| T-S-053 | `POST /conversations/:id/messages` de conversa de outro tenant → 404 (RLS retorna 0 rows) | mock |
| T-S-054 | `POST /conversations/:id/read` zera `unread_count` e marca inbound como lidas | mock transaction |
| T-S-055 | `GET /conversations?unreadOnly=true` filtra correctamente | mock |
| T-S-056 | `GET /conversations?search=<nome>` devolve matches por nome OU telefone | mock |

### `server/routes/pipeline.test.ts`

| ID | Descrição | Tipo de asserção |
| --- | --- | --- |
| T-S-060 | `POST /stages` como `agent` → 403 | mock role |
| T-S-061 | `POST /stages` como `owner` → 201 + row inserida, `order` recalculado | mock |
| T-S-062 | `DELETE /stages/:id` com leads e sem `destinationStageId` → 409 com `leadsAffected: N` | mock |
| T-S-063 | `DELETE /stages/:id` com `destinationStageId` válido → 204, leads movidos, `stage_transitions` inseridas | mock |
| T-S-064 | `DELETE /stages/:id` da única etapa `is_default_entry` → 409 | mock |
| T-S-065 | `PATCH /leads/:id/stage` cria `stage_transition` com `moved_by_user_id` | mock |
| T-S-066 | `DELETE /leads/:id` como `agent` → 403 | mock |
| T-S-067 | `DELETE /leads/:id` como `owner` → cascade verificado (conversation + messages apagados) | mock |

### `server/routes/whatsapp.test.ts`

| ID | Descrição | Tipo de asserção |
| --- | --- | --- |
| T-S-070 | `POST /whatsapp/connection` como `agent` → 403 | mock role |
| T-S-071 | `POST /whatsapp/connection` primeira vez: cria instância uazapi, configura webhook, pede QR | verifica sequência de 3 chamadas `fetch` mock |
| T-S-072 | `POST /whatsapp/connection` com instância existente: só reconfigura webhook + pede QR (não chama `/instance/create`) | verifica ausência de `POST /instance/create` |
| T-S-073 | `POST /whatsapp/disconnect` como `owner` → chama `/instance/disconnect` e actualiza DB | mocks |
| T-S-074 | `GET /whatsapp/connection` devolve campos públicos (sem `instance_token`, sem `webhook_secret`) | assert shape da resposta |

---

## Client — Unit/Component tests (Vitest + Testing Library + MSW)

### `client/src/features/auth/__tests__/`

| ID | Descrição |
| --- | --- |
| T-C-001 | `useAuth` devolve `{ user, tenant, role }` quando `GET /api/auth/me` responde 200 (MSW) |
| T-C-002 | Guard de rota `/settings/pipeline` redirecciona se `role='agent'` |
| T-C-003 | `Login` form dispara `supabase.auth.signInWithPassword` com payload validado por Zod |

### `client/src/features/whatsapp/__tests__/`

| ID | Descrição |
| --- | --- |
| T-C-010 | `ConnectScreen` mostra QR quando `status='qr_pending'` |
| T-C-011 | `ConnectScreen` actualiza para "conectado" ao receber Realtime update na view `whatsapp_sessions_public` |
| T-C-012 | Botão "reconectar" disparado após `disconnected` chama `POST /api/whatsapp/connection` |
| T-C-013 | Agent não vê o botão "conectar" (só owner) |

### `client/src/features/inbox/__tests__/`

| ID | Descrição |
| --- | --- |
| T-C-020 | Lista de conversas ordenada por `lastMessageAt desc` |
| T-C-021 | Click numa conversa dispara `POST /api/inbox/conversations/:id/read` e zera badge de não-lidas |
| T-C-022 | Form de envio — Zod rejeita string vazia; botão fica `disabled` |
| T-C-023 | Resposta 409 `WHATSAPP_DISCONNECTED` mostra toast "Reconecte o WhatsApp" e preserva o texto escrito |
| T-C-024 | Resposta 429 mostra "Tente novamente em X segundos" usando `Retry-After` |
| T-C-025 | Nova mensagem inbound via Realtime aparece no topo da lista em <200ms (teste com fake timer) |

### `client/src/features/pipeline/__tests__/`

| ID | Descrição |
| --- | --- |
| T-C-030 | Drag-and-drop de lead entre colunas dispara `PATCH /api/pipeline/leads/:id/stage` |
| T-C-031 | Optimistic update via React Query: UI muda imediatamente, revalida em erro |
| T-C-032 | `/settings/pipeline` permite reordenar etapas (owner) |
| T-C-033 | Ao remover etapa com leads, aparece modal "escolher destino"; cancelar não faz `DELETE` |
| T-C-034 | Agent NÃO vê `/settings/pipeline` no menu |

---

## E2E (opcional MVP)

Se adicionado posteriormente (Playwright):

| ID | Fluxo |
| --- | --- |
| T-E-001 | Login → conectar WhatsApp (emulador QR stubbed) → enviar mensagem → ver confirmação |
| T-E-002 | Owner customiza pipeline → agent vê as novas etapas |

---

## Mapeamento task → testes (para `/speckit-tasks`)

Cada user story terá tasks que explicitamente referenciam os IDs aqui. Exemplo esperado em `tasks.md`:

> **US3.1** [P1] Implementar `POST /api/inbox/conversations/:id/messages`.
> - [ ] T-S-050 (scenario: disconnected) → Red
> - [ ] T-S-051 (rate limited) → Red
> - [ ] T-S-052 (happy path) → Red
> - [ ] Implementação mínima para Green
> - [ ] Refactor

Esta correspondência garante que o TDD cycle (Red → Green → Refactor) tem pontos de verificação mecânicos durante `/speckit-tasks`.
