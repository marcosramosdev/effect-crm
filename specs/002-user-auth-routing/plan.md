# Implementation Plan: Autenticação de Utilizadores e Roteamento `/app/*` · `/auth/*` · `/`

**Branch**: `002-user-auth-routing` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-user-auth-routing/spec.md`

## Summary

Auth + reorganização de rotas para o CRM já existente da feature 001. Visitante chega a `/` (homepage pública), regista-se em `/auth/register` (auto-serviço — cria novo tenant com role `owner`), entra em `/auth/login`, e usa todo o app sob `/app/*` (inbox, pipeline, definições, ligação WhatsApp). Todas as operações de auth com efeito-colateral em tenant data — registo, login, logout — passam por endpoints `/api/auth/*` no server. O server proxia para o Supabase Auth e devolve os mesmos tokens Supabase ao client (cumpre "sempre referido ao backend" sem violar o Princípio VI da constituição, que proíbe sessões próprias paralelas ao Supabase). Routing é file-based com TanStack Router; data-fetch + mutations passam por React Query (queries para `me`, mutations para login/register/logout). Stack inalterada (Bun/Hono/Supabase/React 19/Vite/Tailwind/DaisyUI). TDD obrigatório em handlers do server (registo atómico, login, logout) e no guard de routing do client (gating `/app/*`, redirecções).

## Technical Context

**Language/Version**: TypeScript strict (ambos workspaces). Server em Bun. Client Vite 8 + React 19. Sem mudança de toolchain.
**Primary Dependencies**:

- **Server** (sem novas deps): `hono`, `@supabase/supabase-js` (já presente), `zod`, `@hono/zod-validator`. Reutiliza middleware de auth + cliente service-role já existentes (`server/middlewares/auth.ts`, `server/db/client.ts`).
- **Client** (sem novas deps): `@tanstack/react-router`, `@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers/zod`, `@supabase/supabase-js` (gestão de tokens locais via `setSession`), `tailwindcss`, `daisyui`.

**Storage**: Supabase. **Sem novas tabelas** — reutiliza `tenants` e `tenant_members` já criadas em `server/db/migrations/001__init.sql`. Identidade vive em `auth.users` (gerido pelo Supabase Auth). RLS já ativo em `tenants`/`tenant_members` (`002__rls.sql`).
**Testing**: Vitest em ambos os workspaces. **TDD obrigatório** (cf. user prompt + Princípio III) para:

- Handler `POST /api/auth/register` — atomicidade tenant+user+member, rollback em falha, validação Zod, erros uniformes.
- Handler `POST /api/auth/login` — proxy para Supabase, normalização de erros (mensagem genérica), case-insensitive email.
- Handler `POST /api/auth/logout` — revogação do refresh token via admin API, idempotência.
- Guards de routing (`/app/_authenticated.tsx` e `/auth/_anonymous.tsx` no TanStack Router) — testes via `createMemoryHistory` + `RouterProvider` em Vitest.

**Target Platform**: idêntico à feature 001 (Docker num VPS, dev em Windows/macOS).
**Project Type**: Web application com dois workspaces (Princípio I).
**Performance Goals**: SC-002 (login ≤5s p95), SC-005 (logout ≤2s p95), SC-007 (homepage ≤3s sem cache). Compatíveis com latências habituais do Supabase Auth (≤500ms).
**Constraints**:

- **Princípio VI** (NON-NEGOTIABLE): server não pode manter sessão paralela. Solução adoptada — endpoints `/api/auth/*` actuam como **proxy fino** ao Supabase Auth: tokens devolvidos ao client são tokens Supabase legítimos (`access_token` + `refresh_token`); o client guarda-os via `supabase.auth.setSession(...)`. Não há "session row" no Postgres deste produto.
- **"Sempre referido ao backend"** (user prompt 002): registo, login e logout são chamados a partir do client **apenas** através de `/api/auth/*`. O client **NÃO** chama `supabase.auth.signInWithPassword` / `signUp` / `signOut` directamente; usa apenas `setSession`/`getSession`/`onAuthStateChange` para gestão de tokens locais.
- **TanStack Router file-based** (Princípio Tech Constraints): routing é alterado com novos ficheiros em `client/src/routes/`. Rotas existentes da feature 001 (`/inbox`, `/pipeline`, `/connect`, `/settings/*`) **são movidas** para sob `/app/*` — refactor obrigatório para satisfazer FR-002.
- **Sem flash de UI protegida** (FR-019): o guard `/app/_authenticated.tsx` usa `beforeLoad` (TanStack Router) que aguarda a resolução do `authQueryOptions` antes de renderizar; a SPA mostra um spinner enquanto resolve. Princípio: nenhum componente protegido renderiza sem `me` resolvido.
- **Mensagens de erro uniformes** (FR-008, FR-011): qualquer erro do Supabase Auth é traduzido server-side para um conjunto pequeno e fixo de códigos (`INVALID_CREDENTIALS`, `EMAIL_EXISTS_OR_INVALID`, `WEAK_PASSWORD`, `TENANT_NAME_INVALID`, `RATE_LIMITED`); mensagens humanas em PT.

**Scale/Scope**: ~10–50 tenants iniciais, 1–5 utilizadores por tenant (cf. spec 001). Não há requisito de >100 logins concorrentes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Estado | Nota |
| --- | --- | --- |
| I. Workspace Independence | ✅ | Zero monorepo tooling. Frontend continua a importar tipos de `server/types/` via path alias documentado. |
| II. Type Safety & Strict TS | ✅ | Zod schemas em `server/types/auth.ts` (novo): `RegisterRequestSchema`, `LoginRequestSchema`, `AuthErrorSchema`, `MeResponseSchema` (refactor do existente). `z.infer<>` no client. Sem `any`. |
| III. Test-First for Non-Trivial Logic | ✅ | TDD explícito (Vitest) em handlers `register`/`login`/`logout` + guards do router. Glue puro (componentes de form que só fazem `mutate(values)`) dispensa teste — confirmado pelo Princípio. Cf. user prompt: "siga usando TDD para desenvolver e testar o codigo". |
| IV. Conventions as Code | ✅ | Sem alterações a Prettier/ESLint. |
| V. Simplicity & YAGNI | ✅ | Um único modo de registo (auto-serviço cria tenant — Opção A da Q1). Sem "esqueci-me da senha", sem login social, sem MFA, sem edição de tenant após registo. Spec inclui assumptions explícitos para esses excluídos. |
| VI. Multi-Tenant Isolation & Secret Hygiene (NON-NEGOTIABLE) | ✅ | `SUPABASE_SERVICE_ROLE_KEY` permanece server-only. O server **proxia** ao Supabase Auth (não mints sessões próprias) — tokens entregues ao client são Supabase tokens. RLS em `tenants`/`tenant_members` é a barreira de leitura; o registo bootstrap (criação de tenant + member para o primeiro owner) usa service-role num path quarentinado em `server/routes/auth.ts`. |

**Resultado do gate (pré-Phase 0)**: **PASS**. Sem violações. Reavaliação pós-Phase 1 mais abaixo.

## Project Structure

### Documentation (this feature)

```text
specs/002-user-auth-routing/
├── plan.md              # this file
├── research.md          # Phase 0 — decisões resolvidas + alternativas
├── data-model.md        # Phase 1 — schemas Zod + reutilização tabelas existentes
├── quickstart.md        # Phase 1 — passos para validar a feature end-to-end
├── contracts/
│   ├── api.md           # Phase 1 — endpoints /api/auth/* (request/response/erros)
│   └── auth.md          # Phase 1 — contrato cliente↔server: storage de tokens, fluxos
├── checklists/
│   └── requirements.md  # quality checklist
└── tasks.md             # Phase 2 (criado por /speckit-tasks, não aqui)
```

### Source Code (repository root)

Refactor das rotas existentes + adições. Mantém a arquitectura de pastas da feature 001.

```text
server/
├── routes/
│   └── auth.ts                  # AMPLIADO: já tem GET /me; adiciona POST /register, /login, /logout
├── routes/
│   └── auth.test.ts             # AMPLIADO: TDD para os novos handlers
├── lib/
│   └── auth/
│       ├── register.ts          # NOVO: lógica atómica createUser + tenant + member (service-role)
│       ├── register.test.ts     # NOVO: TDD da atomicidade + rollback
│       ├── error-mapping.ts     # NOVO: traduz erros Supabase → códigos canónicos uniformes
│       └── error-mapping.test.ts# NOVO
├── types/
│   └── auth.ts                  # AMPLIADO: schemas Zod para Register/Login/Logout/AuthError
└── index.ts                     # MODIFICADO: monta /api/auth/{login,register,logout}

client/
├── src/
│   ├── routes/
│   │   ├── __root.tsx           # MODIFICADO: layout neutro (header só dentro de /app)
│   │   ├── index.tsx            # REESCRITO: homepage pública (era redirect)
│   │   ├── auth.tsx             # NOVO: layout `/auth` (centra cards) + beforeLoad: se sessão → /app
│   │   ├── auth/
│   │   │   ├── login.tsx        # NOVO
│   │   │   └── register.tsx     # NOVO
│   │   ├── app.tsx              # NOVO: layout `/app/*` + beforeLoad: se !sessão → /auth/login + return-to
│   │   ├── app/
│   │   │   ├── index.tsx        # NOVO: redirect para /app/inbox ou /app/connect (lógica antes de index.tsx raiz)
│   │   │   ├── connect.tsx      # MOVIDO de routes/connect.tsx
│   │   │   ├── inbox/           # MOVIDO de routes/inbox/
│   │   │   ├── pipeline/        # MOVIDO de routes/pipeline/
│   │   │   └── settings/        # MOVIDO de routes/settings/
│   │   └── __tests__/
│   │       └── guard.test.tsx   # AMPLIADO: cobertura para /app/* e /auth/*
│   ├── features/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx       # NOVO (componente de UI consumido por /auth/login)
│   │   │   ├── RegisterScreen.tsx    # NOVO
│   │   │   ├── HomePage.tsx          # NOVO (consumido por / quando sem sessão)
│   │   │   ├── useLoginMutation.ts   # NOVO (React Query mutation)
│   │   │   ├── useRegisterMutation.ts# NOVO
│   │   │   ├── useLogoutMutation.ts  # NOVO
│   │   │   └── __tests__/
│   │   │       ├── useLoginMutation.test.ts
│   │   │       └── useRegisterMutation.test.ts
│   │   └── shell/
│   │       └── UserMenu.tsx          # NOVO: dropdown com "Sair" — montado em layout app.tsx
│   ├── hooks/
│   │   └── useAuth.ts                # MODIFICADO: continua a expor `authQueryOptions`; adiciona `clearAuthCache()`
│   └── lib/
│       ├── api.ts                    # MODIFICADO: ao receber 401, não chama signOut() directo do Supabase — chama `clearSession()` local
│       └── supabase.ts               # INALTERADO
└── client/src/routeTree.gen.ts       # GERADO automaticamente — não editar
```

**Structure Decision**: dois workspaces independentes (server + client), idêntico à feature 001. Não introduz pastas-raiz novas. As mudanças concentram-se em: (a) novo prefixo de rotas no client, (b) endpoints `/api/auth/*` no server, (c) extracção de mapeamento de erros Supabase para um módulo testável.

## Phase 0 — Outline & Research

Cf. [research.md](./research.md). Itens resolvidos:

1. **Modo de registo** (FR-010) → auto-serviço cria novo tenant. Decisão: Opção A da Q1.
2. **"Sempre referido ao backend" vs Princípio VI** → server proxia Supabase Auth; tokens devolvidos são Supabase tokens; client gere-os via `setSession`. Não há sessão paralela.
3. **Pattern de proxy ao Supabase Auth** → server usa `@supabase/supabase-js` com `SUPABASE_URL` + `SUPABASE_ANON_KEY` para `signInWithPassword` (login); usa `SUPABASE_SERVICE_ROLE_KEY` apenas em `auth.admin.createUser` + insert em `tenants`/`tenant_members` (registo); usa `auth.admin.signOut(jwt)` para logout (revoga refresh).
4. **Atomicidade no registo** → ordem: `createUser` (admin) → insert `tenants` → insert `tenant_members`. Em falha após `createUser`, executar `auth.admin.deleteUser(id)` como rollback. Não usa transação Postgres porque `auth.users` está num schema gerido. TDD cobre rollback.
5. **TanStack Router guards** → padrão `beforeLoad` em rota-pai (`app.tsx` e `auth.tsx`). `app.tsx.beforeLoad` faz `ensureQueryData(authQueryOptions)`; em falha redirecciona para `/auth/login` com `search.redirect` = pathname original. `auth.tsx.beforeLoad` faz o inverso.
6. **Mitigação de força bruta** (FR-021) → delegada ao Supabase Auth (rate limit nativo por IP). Não duplicamos no server. Documentado como dependência.
7. **Mensagens uniformes** → tabela de mapeamento `error-mapping.ts` traduz erros Supabase (ex.: `invalid_grant`, `email_exists`) num enum fechado de 5 códigos. Login responde sempre com `INVALID_CREDENTIALS` em qualquer falha de credenciais.

**Output**: research.md com decisão + rationale + alternativas para cada item.

## Phase 1 — Design & Contracts

**Pré-requisitos**: research.md completo.

### Data model

Cf. [data-model.md](./data-model.md). Resumo: **zero migrações novas**. Reutiliza:

- `auth.users` (Supabase managed) — identidade.
- `tenants` (existente) — `id`, `name`, `created_at`. Validação `name`: 2–80 chars (FR-010a).
- `tenant_members` (existente) — `(tenant_id, user_id, role)`. Insert imediatamente após registo com `role='owner'`.

Schemas Zod em `server/types/auth.ts` (novos):

- `RegisterRequestSchema`: `{ email: string.email, password: string.min(8), tenantName: string.min(2).max(80) }`
- `LoginRequestSchema`: `{ email: string.email, password: string.min(1) }`
- `AuthSessionSchema`: `{ accessToken: string, refreshToken: string, expiresAt: number }` (devolvido em 200 de register/login)
- `AuthErrorCodeSchema`: enum `['INVALID_CREDENTIALS','EMAIL_EXISTS_OR_INVALID','WEAK_PASSWORD','TENANT_NAME_INVALID','RATE_LIMITED','UNKNOWN']`
- `MeResponseSchema` (refactor do existente em `auth.ts`): `{ userId, email, tenantId, tenantName, role }` — inalterado, mas exportado.

### Contracts

Cf. [contracts/api.md](./contracts/api.md) e [contracts/auth.md](./contracts/auth.md). Endpoints novos:

- `POST /api/auth/register` — público (sem JWT). Body: `RegisterRequest`. 201 → `AuthSession`. Erros: `409 EMAIL_EXISTS_OR_INVALID`, `400 WEAK_PASSWORD`/`TENANT_NAME_INVALID`, `429 RATE_LIMITED`.
- `POST /api/auth/login` — público. Body: `LoginRequest`. 200 → `AuthSession`. Erros: `401 INVALID_CREDENTIALS` (uniforme — qualquer falha de credenciais), `429 RATE_LIMITED`.
- `POST /api/auth/logout` — autenticado (Bearer). 204. Idempotente — 204 mesmo se token já inválido.
- `GET /api/auth/me` — **inalterado** (já existe na feature 001).

### Quickstart

Cf. [quickstart.md](./quickstart.md). Cobre: setup local, registo de owner, login, navegar `/app/*`, logout, validar gating.

### Agent context update

Atualiza marker `<!-- SPECKIT START -->` em `CLAUDE.md` para `specs/002-user-auth-routing/plan.md`.

**Output**: data-model.md, contracts/api.md, contracts/auth.md, quickstart.md, CLAUDE.md atualizado.

## Constitution Check (re-evaluation post-Phase 1)

| Princípio | Estado | Nota |
| --- | --- | --- |
| I | ✅ | Sem mudança. |
| II | ✅ | Schemas Zod em `server/types/auth.ts`; client deriva tipos via `z.infer`. |
| III | ✅ | Conjunto de testes Vitest definido em data-model + contracts (handler-level + guard-level + error-mapping). |
| IV | ✅ | Sem mudança. |
| V | ✅ | Sem mudança. |
| VI | ✅ | Confirmado: registo é o **único** path com service-role e está confinado a `server/lib/auth/register.ts`. Login não usa service-role (anon client + signInWithPassword). |

**Resultado pós-Phase 1**: **PASS**. Nada para "Complexity Tracking".

## Complexity Tracking

*N/A — sem violações.*
