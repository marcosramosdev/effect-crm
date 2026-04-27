# Phase 1 — Data Model: Auth & Routing (Spec 002)

## Resumo

**Zero migrações novas.** A feature reutiliza as tabelas criadas em `server/db/migrations/001__init.sql` (`tenants`, `tenant_members`) + a tabela gerida pelo Supabase (`auth.users`). Toda a lógica nova é em **Zod schemas** + **endpoints**.

---

## Entidades persistidas

### `auth.users` (Supabase managed)

Identidade do utilizador. Não-tocada directamente — só via `supabase.auth.admin.*`.

Campos relevantes:

- `id` (uuid) — PK; referenciado em `tenant_members.user_id`.
- `email` (text, citext-like) — unicidade global garantida pelo Supabase. Comparação case-insensitive nativa.
- `encrypted_password` — gerido pelo Supabase.
- `email_confirmed_at` — opcional (config Supabase).

**Validação no nosso código**: nenhuma — confiamos no Supabase. Mapeamos erros via `error-mapping.ts`.

### `tenants` (existente)

```sql
create table tenants (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now()
);
```

**Uso nesta feature**:

- Insert no path de registo: `db.from('tenants').insert({ name: tenantName }).select('id').single()`.
- Validação `name`: aplicada **server-side** (Zod) — 2–80 chars (FR-010a). Sem unique constraint global no `name` (vários tenants podem partilhar nome).
- RLS já existente (`002__rls.sql`): apenas members vêem o seu tenant.

### `tenant_members` (existente)

```sql
create table tenant_members (
  tenant_id  uuid not null references tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner', 'agent')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
```

**Uso nesta feature**:

- Insert no path de registo: `role='owner'` para o utilizador acabado de criar.
- Sem alteração à RLS.

### State transitions (registo)

```text
nada
  └─[POST /api/auth/register válido]─┐
                                     ▼
                  auth.users (1) + tenants (1) + tenant_members (1) — tudo persistido
                                     │
                          [client recebe AuthSession]
                                     │
                          ▼ supabase.auth.setSession(...)
                          sessão activa em /app
```

Em falha após `auth.users` ter sido criado, **rollback compensatório** repõe o estado a "nada" (cf. research R3).

---

## Schemas Zod (novos)

Localização: `server/types/auth.ts` (workspace partilhado via path alias do client).

### Request schemas

```ts
import { z } from 'zod'

export const RegisterRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),     // 72 = bcrypt limit do Supabase
  tenantName: z.string().trim().min(2).max(80),
})

export const LoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
})

export const LogoutRequestSchema = z.object({}).strict()  // sem body; 204 em sucesso
```

### Response schemas

```ts
export const AuthSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number().int().positive(),  // unix seconds
})

export const MeResponseSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  role: z.enum(['owner', 'agent']),
})
```

### Error schemas

```ts
export const AuthErrorCodeSchema = z.enum([
  'INVALID_CREDENTIALS',
  'EMAIL_EXISTS_OR_INVALID',
  'WEAK_PASSWORD',
  'TENANT_NAME_INVALID',
  'RATE_LIMITED',
  'UNKNOWN',
])

export const AuthErrorBodySchema = z.object({
  error: z.object({
    code: AuthErrorCodeSchema,
    message: z.string(),
  }),
})
```

### Tipos derivados

```ts
export type RegisterRequest  = z.infer<typeof RegisterRequestSchema>
export type LoginRequest     = z.infer<typeof LoginRequestSchema>
export type AuthSession      = z.infer<typeof AuthSessionSchema>
export type MeResponse       = z.infer<typeof MeResponseSchema>
export type AuthErrorCode    = z.infer<typeof AuthErrorCodeSchema>
export type AuthErrorBody    = z.infer<typeof AuthErrorBodySchema>
```

Importáveis no client via `@server/types/auth` (alias já configurado em `client/tsconfig.json`).

---

## Estado client-side (TanStack Query)

| Query | Key | queryFn | staleTime |
|---|---|---|---|
| Auth me | `['auth', 'me']` | `apiFetch('/auth/me')` | 5 min (mantido da feature 001) |

| Mutation | Effect | onSuccess |
|---|---|---|
| `useLoginMutation` | `apiFetch('/auth/login', { method: 'POST', body })` → `AuthSession` | `supabase.auth.setSession(tokens)` + `queryClient.setQueryData(['auth','me'], …)` (opcional) + `router.invalidate()` |
| `useRegisterMutation` | `apiFetch('/auth/register', { method: 'POST', body })` → `AuthSession` | idem login |
| `useLogoutMutation` | `apiFetch('/auth/logout', { method: 'POST' })` (204) | `supabase.auth.signOut({ scope: 'local' })` + `queryClient.clear()` + `router.navigate({ to: '/' })` |

**Invariante**: nenhum componente sob `/app/*` deve renderizar sem `['auth','me']` fresh — garantido pelo `beforeLoad` do `app.tsx`.

---

## Validação cruzada (FRs ↔ artefactos)

| FR | Artefacto |
|---|---|
| FR-007 (form valida formato/força) | `RegisterRequestSchema` no client (form) **e** server (handler). |
| FR-008 (mensagem genérica para email duplicado) | `error-mapping.ts` → `EMAIL_EXISTS_OR_INVALID` com mensagem ambígua. |
| FR-009 (registo → sessão activa) | Endpoint devolve `AuthSession`; mutation cliente chama `setSession`. |
| FR-010 / FR-010a (tenant + nome empresa) | Campo `tenantName` em `RegisterRequestSchema` + insert atómico em `tenants`. |
| FR-011 (mensagem genérica login) | `error-mapping.ts` → `INVALID_CREDENTIALS` para qualquer falha de credenciais. |
| FR-013 (sessão entre reloads) | Tokens em Supabase JS storage (default `localStorage` + `auth.persistSession=true`). |
| FR-016 (gating /app/*) | `beforeLoad` em `app.tsx`. |
| FR-017 (sessão activa em /auth/* → /app) | `beforeLoad` em `auth.tsx`. |
| FR-019 (sem flash) | `beforeLoad` resolve antes de mount; spinner no loader pendente do router. |
| FR-020 (email case-insensitive) | `.toLowerCase()` em `RegisterRequestSchema` + `LoginRequestSchema`. |
| FR-022 (401 → erro auth, nunca conteúdo cross-tenant) | `apiFetch` já trata 401; middleware `auth.ts` já bloqueia. |

---

## Cobertura TDD (resumo)

| Ficheiro de teste (a criar) | Cobre |
|---|---|
| `server/lib/auth/register.test.ts` | atomicidade + 4 caminhos de rollback + email duplicado + tenant_name inválido |
| `server/lib/auth/error-mapping.test.ts` | matriz da tabela em research R6 (uma asserção por linha) |
| `server/routes/auth.test.ts` (extensão) | wiring HTTP: 201/200/401/409/400/429/204 com bodies bem formados (Zod parse) |
| `client/src/features/auth/__tests__/useLoginMutation.test.ts` | onSuccess chama `setSession` + invalidates router; onError preserva form values |
| `client/src/features/auth/__tests__/useRegisterMutation.test.ts` | idem para registo (incluindo tenantName no body) |
| `client/src/routes/__tests__/guard.test.tsx` (extensão) | matriz das 4 combinações descritas em research R4 |
