# API Contracts — `/api/auth/*`

Todos os endpoints são montados em `server/index.ts` sob `/api/auth`. Bodies em JSON. Schemas Zod canónicos vivem em `server/types/auth.ts` (cf. data-model.md).

---

## `POST /api/auth/register`

**Auth**: público (sem `Authorization`).

**Request body**:

```json
{
  "email": "owner@empresa.pt",
  "password": "secret-with-8+-chars",
  "tenantName": "Empresa XPTO"
}
```

Validação Zod: `RegisterRequestSchema`. Em falha de schema → 400 com `code: 'WEAK_PASSWORD'` (se for password) ou `code: 'TENANT_NAME_INVALID'` (se for nome) ou `code: 'EMAIL_EXISTS_OR_INVALID'` (se for email).

**Sucesso** — `201 Created`:

```json
{
  "accessToken": "<supabase JWT>",
  "refreshToken": "<supabase refresh>",
  "expiresAt": 1761500000
}
```

Body conforme `AuthSessionSchema`. Side effects: `auth.users` + `tenants` + `tenant_members` (role=owner) criados atomicamente.

**Erros**:

| HTTP | code | Quando |
|---|---|---|
| 400 | `WEAK_PASSWORD` | password <8 chars ou rejeitada pelo Supabase |
| 400 | `TENANT_NAME_INVALID` | tenantName fora de 2..80 |
| 409 | `EMAIL_EXISTS_OR_INVALID` | email já registado **ou** rejeitado pelo Supabase |
| 429 | `RATE_LIMITED` | Supabase rate limit |
| 500 | `UNKNOWN` | erro inesperado (rollback executado) |

Body de erro conforme `AuthErrorBodySchema`.

---

## `POST /api/auth/login`

**Auth**: público.

**Request body**:

```json
{
  "email": "owner@empresa.pt",
  "password": "secret-with-8+-chars"
}
```

Validação Zod: `LoginRequestSchema`.

**Sucesso** — `200 OK`:

```json
{
  "accessToken": "<supabase JWT>",
  "refreshToken": "<supabase refresh>",
  "expiresAt": 1761500000
}
```

**Erros**:

| HTTP | code | Quando |
|---|---|---|
| 401 | `INVALID_CREDENTIALS` | email não existe **OU** senha errada (mesma resposta — FR-011) |
| 429 | `RATE_LIMITED` | Supabase rate limit |
| 500 | `UNKNOWN` | inesperado |

**Importante**: o handler **NUNCA** distingue "email inexistente" de "senha errada". Mesmo em validação Zod falhada por email mal-formado, devolve `401 INVALID_CREDENTIALS` (não 400) para uniformizar.

---

## `POST /api/auth/logout`

**Auth**: `Authorization: Bearer <accessToken>` requerido.

**Request body**: vazio (`{}` ou nada).

**Sucesso** — `204 No Content`.

Side effects: `supabase.auth.admin.signOut(jwt)` (revoga refresh token server-side). Idempotente — `204` mesmo se token já tiver sido invalidado.

**Erros**:

| HTTP | code | Quando |
|---|---|---|
| 401 | `INVALID_CREDENTIALS` | header ausente / formato inválido |
| 500 | `UNKNOWN` | inesperado (NÃO falha se token já estava revogado) |

---

## `GET /api/auth/me`

**Inalterado** desde feature 001. Documentado aqui para completude.

**Auth**: Bearer.

**Sucesso** — `200`:

```json
{
  "userId": "uuid",
  "email": "owner@empresa.pt",
  "tenantId": "uuid",
  "tenantName": "Empresa XPTO",
  "role": "owner"
}
```

Body conforme `MeResponseSchema`.

**Erros**: `401 UNAUTHORIZED`, `404 NOT_FOUND` (tenant não encontrado).

---

## Fluxo end-to-end (sequência)

```text
[client]                            [server /api/auth/*]                [Supabase]
   │  POST /register {email,…}     │                                     │
   ├──────────────────────────────▶│                                     │
   │                               │ admin.createUser(email,password) ──▶│
   │                               │◀── userId ───────────────────────── │
   │                               │ INSERT tenants ────────────────────▶│
   │                               │◀── tenantId ────────────────────── │
   │                               │ INSERT tenant_members (owner) ─────▶│
   │                               │◀── ok ─────────────────────────── │
   │                               │ admin.signInWithEmail(email,pwd) ──▶│ (gera tokens)
   │                               │◀── tokens ───────────────────────── │
   │  201 AuthSession               │                                     │
   │◀──────────────────────────────│                                     │
   │ supabase.auth.setSession(...)  │                                     │
   │ React Query invalidates 'me'   │                                     │
   │ TanStack Router beforeLoad     │                                     │
   │   ─ ensureQueryData('me') ─────┴──▶ GET /me (Bearer) ───┐           │
   │                                                          ▼           │
   │                                                       [valida JWT]   │
   │                                                       [lê tenants]   │
   │                                                       [200 me body]  │
   │ render /app/index.tsx                                                 │
```
