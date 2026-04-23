# API Contracts — Overview

Todos os endpoints HTTP expostos pelo server vivem sob `/api/*` (regra da constituição). Respostas em JSON. Schemas Zod em `server/types/` — ambos os lados importam (ver `plan.md` para o alias).

## Autenticação

- Todos os endpoints (excepto os marcados "público") exigem `Authorization: Bearer <supabase_jwt>`.
- Middleware `server/middlewares/auth.ts`:
  1. Valida o JWT com a chave pública do projecto Supabase.
  2. Extrai `sub` (user_id).
  3. Procura `tenant_members` do user e resolve `tenant_id` + `role`. Se o user pertence a >1 tenant, a MVP escolhe o primeiro e loga um warning (Assumption: 1 user = 1 tenant na MVP).
  4. Anexa `{ userId, tenantId, role }` ao contexto Hono (`c.var`).
- Middleware `server/middlewares/tenant-guard.ts` assegura que `tenantId` está presente antes de qualquer handler tenant-scoped.

## Convenção de erros

```json
{
  "error": {
    "code": "RATE_LIMITED" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "WHATSAPP_DISCONNECTED" | "CONFLICT" | "INTERNAL",
    "message": "Human-readable description in pt-PT",
    "details": { "...optional" }
  }
}
```

Códigos HTTP: `400` validation, `401` unauthorized, `403` forbidden (e.g., agent a tentar editar pipeline), `404` not found, `409` conflict (e.g., remover etapa com leads sem destino), `429` rate limited (com `Retry-After`), `500` internal.

## Contratos por domínio

Ver ficheiros irmãos:

- [`auth.md`](./auth.md) — `/api/auth/*`
- [`whatsapp.md`](./whatsapp.md) — `/api/whatsapp/*` (backed por uazapiGO)
- [`inbox.md`](./inbox.md) — `/api/inbox/*`
- [`pipeline.md`](./pipeline.md) — `/api/pipeline/*`
- [`webhooks.md`](./webhooks.md) — `/api/webhooks/uazapi/:webhookSecret` (inbound da uazapi; **público** — auth por segredo no path)
- [`test-strategy.md`](./test-strategy.md) — inventário de testes por camada com IDs (`T-S-xxx`, `T-C-xxx`) referenciados nas tasks

## Shared Zod modules (em `server/types/`)

- `common.ts` — `TenantId`, `UserId`, `LeadId`, `ConversationId`, `MessageId`, `StageId`, `ErrorResponseSchema`, `RoleSchema`.
- `auth.ts` — `MeResponseSchema`.
- `whatsapp.ts` — `ConnectionStatusSchema`, `ConnectionResponseSchema`, `StartConnectionResponseSchema` (inclui `qr`).
- `inbox.ts` — `ConversationSummarySchema`, `ConversationListResponseSchema`, `ConversationDetailSchema`, `MessageSchema`, `SendMessageRequestSchema`, `SendMessageResponseSchema`, `MarkReadResponseSchema`.
- `pipeline.ts` — `PipelineStageSchema`, `StageListResponseSchema`, `CreateStageRequestSchema`, `UpdateStageRequestSchema`, `DeleteStageRequestSchema` (inclui `destination_stage_id` quando a etapa origem tem leads), `LeadSchema`, `LeadListResponseSchema`, `MoveLeadRequestSchema`, `DeleteLeadResponseSchema`.

Todos os `Schema` devem ter um tipo TypeScript exportado: `export type X = z.infer<typeof XSchema>`.
