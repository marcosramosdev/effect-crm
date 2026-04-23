# Implementation Plan: WhatsApp CRM Core

**Branch**: `001-whatsapp-crm-core` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-whatsapp-crm-core/spec.md`

## Summary

MVP de um CRM multi-tenant para empresas de marketing digital: conectar WhatsApp por tenant, inbox unificado em tempo quasi-real, resposta a leads, pipeline de etapas por omissão customizáveis. Stack fixada pelo utilizador: Hono + Supabase no backend; React 19 + Vite + TanStack Router/Query + React Hook Form + Zod + Tailwind/DaisyUI no frontend; tipos partilhados em `server/types/`. Integração WhatsApp via **uazapiGO** (serviço hospedado, docs `https://docs.uazapi.com/`) consumida por REST + webhooks, encapsulada atrás de um adapter no server. Isolamento multi-tenant por RLS do Supabase. Realtime via Supabase Realtime. Produção = um container que serve `/api/*` + SPA.

## Technical Context

**Language/Version**: TypeScript strict (ambos workspaces), Bun como runtime do server e package manager; Vite 8 + React 19 no client.
**Primary Dependencies**:

- **Server**: `hono` (já presente), `@supabase/supabase-js`, `zod` (partilhado), `@hono/zod-validator`. Integração WhatsApp via **uazapiGO** (`https://docs.uazapi.com/`, servidor `https://{free|api}.uazapi.com`) consumida com `fetch` nativo do Bun — sem SDK oficial, sem biblioteca local de socket WhatsApp.
- **Client** (já presentes no `package.json`): `react 19`, `@tanstack/react-router`, `@tanstack/react-query`, `react-hook-form`, `zod`, `tailwindcss`, `daisyui`. A adicionar: `@supabase/supabase-js` e `@hookform/resolvers` (para usar schemas Zod em forms).

**Storage**: Supabase (Postgres com RLS + Auth + Realtime). A sessão WhatsApp propriamente dita (credenciais, signal keys) vive dentro da uazapi; o nosso banco guarda apenas o `instance_id` + `instance_token` (este último confinado a acesso service-role) + webhook secret por tenant.
**Testing**: Vitest em ambos os workspaces. Testes de handlers Hono via `app.request()` (test helper nativo). Cliente Supabase mockado em testes unitários; testes de integração do server contra um Supabase local opcional (não bloqueia MVP).
**Target Platform**: Docker num VPS Linux em produção (um processo, uma porta). Desenvolvimento em Windows/macOS; cliente em `:5173`, server em `:3000`.
**Project Type**: Web application — dois workspaces independentes (per constituição Princípio I). Em produção o server serve `client/dist` com SPA fallback.
**Performance Goals**: Ver SCs do spec. Concretamente: p95 mensagem-recebida-no-inbox ≤5s; p95 confirmação-de-envio ≤15s; UI do inbox fluida com 500 conversas / 10k mensagens por tenant.
**Constraints**:

- **Multi-tenancy via RLS** (Princípio VI): toda a tabela tenant-scoped tem `tenant_id`; todas as queries user-scoped usam cliente Supabase com JWT.
- **Secret hygiene**: `SUPABASE_SERVICE_ROLE_KEY`, `UAZAPI_ADMIN_TOKEN` e `uazapi_instance_token` por tenant nunca saem do server.
- **Adapter WhatsApp** (Princípio VI + Tech Constraints): único entry-point para a API uazapi em `server/lib/whatsapp/` (cliente HTTP + receiver de webhooks); feature code usa apenas a interface desse adapter.
- **Workspace independence** (Princípio I): sem monorepo tooling; o cliente importa tipos de `server/types/` via path alias explícito — coupling documentado.
- **Integração WhatsApp não-oficial**: uazapi é um serviço hospedado de terceiros (não API oficial do Meta). Assume-se instabilidade (tanto do WhatsApp subjacente como do próprio uazapi) e ToS-adjacent; UX tolera desconexões.
- **Webhook público**: para receber mensagens, o nosso server precisa de um endpoint `/api/webhooks/uazapi/:webhookSecret` acessível a partir da internet — autenticado por um segredo per-tenant embebido no URL.

**Scale/Scope**: MVP para 10–50 tenants, cada um com ≤500 conversas / ≤10k mensagens (cf. SC-008) e dezenas de agentes concorrentes. Um Bun process por deploy; escalonamento horizontal fora do escopo da MVP.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Estado | Nota |
| --- | --- | --- |
| I. Workspace Independence | ✅ (com coupling explícito) | Nenhum monorepo tooling. Cliente importa de `server/types/` via path alias documentado — declarado explicitamente em `client/tsconfig.json` + `client/vite.config.ts`; instalação/build de cada workspace permanecem independentes. |
| II. Type Safety & Strict TS | ✅ | Zod-first, `z.infer<>` para tipos; nenhum `any` planeado. `routeTree.gen.ts` permanece gerado. |
| III. Test-First for Non-Trivial Logic | ✅ | Vitest planeado para: RLS-bypass guards, mapping de payload uazapi→DB (webhook-handler), validação do segredo do webhook, rate-limiter, reducers de pipeline; bug fixes com regressão. Glue code dispensa. |
| IV. Conventions as Code | ✅ | Sem alterações a ESLint/Prettier. |
| V. Simplicity & YAGNI | ✅ | Um adapter WhatsApp, dois roles apenas (owner/agent), um pipeline por tenant, um número WhatsApp por tenant. Sem feature flags, sem abstrações especulativas. |
| VI. Multi-Tenant Isolation & Secret Hygiene (NON-NEGOTIABLE) | ✅ | RLS em todas as tabelas tenant-scoped; service-role confinado a `server/lib/whatsapp/` e a ingest; cliente só usa `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; auth = JWT Supabase. Deletion/privacy baseline: MVP dá ao owner acção "apagar lead" (cascade). |

**Resultado do gate (pré-Phase 0)**: **PASS**. Sem violações a justificar em Complexity Tracking.

Reavaliação pós-Phase 1 abaixo nesta secção, após confirmar o data model + contratos.

## Project Structure

### Documentation (this feature)

```text
specs/001-whatsapp-crm-core/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API endpoints + shared Zod schemas)
│   ├── api.md
│   ├── auth.md
│   ├── whatsapp.md
│   ├── inbox.md
│   └── pipeline.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (created by /speckit-tasks, NOT here)
```

### Source Code (repository root)

Respeita a arquitectura de pastas já presente em `server/` e `client/src/`. Só adiciona subpastas quando for necessário colocar código novo.

```text
server/
├── index.ts                     # entry (existe) — montará app + middlewares + rotas
├── db/
│   ├── client.ts                # supabase clients (user-scoped via JWT, service-role singleton)
│   └── migrations/              # SQL declarativo (schemas + RLS policies) a executar no Supabase
├── middlewares/
│   ├── auth.ts                  # valida JWT Supabase; anexa user + tenant_id ao contexto
│   ├── tenant-guard.ts          # garante que todos os handlers lêem tenant_id do contexto
│   └── error.ts                 # resposta JSON uniforme
├── routes/
│   ├── auth.ts                  # /api/auth/me
│   ├── whatsapp.ts              # /api/whatsapp/*
│   ├── inbox.ts                 # /api/inbox/*
│   ├── pipeline.ts              # /api/pipeline/*
│   └── webhooks.ts              # /api/webhooks/uazapi/:webhookSecret (entrada inbound da uazapi)
├── validator/
│   └── index.ts                 # re-export helpers que envolvem @hono/zod-validator (opcional)
├── lib/
│   └── whatsapp/
│       ├── index.ts             # provider interface pública (connect, disconnect, sendText, status, ensureInstance)
│       ├── uazapi-client.ts     # HTTP client para uazapiGO (único ficheiro a tocar a API uazapi)
│       ├── webhook-handler.ts   # parsing + dispatch dos eventos uazapi (messages, messages_update, connection)
│       └── rate-limiter.ts      # token-bucket por tenant (proteção acima dos limites da uazapi)
└── types/                       # ⭐ tipos + schemas zod partilhados (source of truth)
    ├── auth.ts
    ├── whatsapp.ts
    ├── inbox.ts
    ├── pipeline.ts
    └── index.ts

client/src/
├── main.tsx                     # entry (existe)
├── router.tsx / routeTree.gen.ts (existem; não tocar no último)
├── routes/                      # file-based routing
│   ├── __root.tsx               # (existe) layout base
│   ├── index.tsx                # redirect para /inbox ou /connect conforme estado
│   ├── login.tsx                # ecrã de login (Supabase Auth email+password)
│   ├── connect.tsx              # fluxo de conexão do WhatsApp (QR + estado)
│   ├── inbox/
│   │   ├── index.tsx            # lista de conversas
│   │   └── $conversationId.tsx  # conversa + histórico + input
│   ├── pipeline/
│   │   └── index.tsx            # kanban
│   └── settings/
│       ├── pipeline.tsx         # customização das etapas (owner)
│       └── team.tsx             # invite/remove users (owner)
├── features/                    # lógica por domínio (queries + mutations + vistas)
│   ├── auth/
│   ├── whatsapp/
│   ├── inbox/
│   └── pipeline/
├── components/                  # UI reutilizável (DaisyUI + Tailwind)
├── hooks/                       # hooks partilhados (useAuth, useTenant, usePermissions)
└── lib/
    ├── supabase.ts              # createClient com VITE_SUPABASE_URL + ANON_KEY
    └── api.ts                   # fetch wrapper que anexa Authorization: Bearer <jwt>

# Shared types (source of truth: server/types)
# Client importa via path alias:
#   client/tsconfig.json  -> paths: { "@shared/*": ["../server/types/*"] }
#   client/vite.config.ts -> alias: "@shared/*" → "../server/types/*"
# Include em client/tsconfig.json estende-se para incluir "../server/types/**/*.ts"
```

**Structure Decision**: Web application (Option 2) adaptada à arquitectura real do repo. Os dois workspaces `server/` e `client/` permanecem independentes (Princípio I); a única coupling é source-level (types) e explícita, declarada no `client/tsconfig.json` + Vite config. A estrutura de `server/*` reutiliza as pastas existentes (`routes/`, `middlewares/`, `validator/`, `db/`, `lib/`, `types/`) conforme a sugestão em `server/CLAUDE.md`.

## Development Approach (TDD)

Esta feature é desenvolvida com **TDD pragmático** — conforme Princípio III da constituição, testes precedem ou acompanham a implementação para toda a lógica não trivial. Esta secção explicita o workflow, a pirâmide de testes e a estratégia de doubles para que o código seja validado mecanicamente antes de ser aceite em PR.

**Runners**: **Bun test** no server (`bun test`), **Vitest** no client (`bun --bun run test`, já configurado em `client/package.json`). Fixtures e helpers em TypeScript puro — ambos os runners consomem `.test.ts`/`.test.tsx` directamente sem transpile. Ver rationale em `research.md` R-012.

### Ciclo Red → Green → Refactor (por unidade de trabalho)

Uma "unidade de trabalho" = uma tarefa do `tasks.md` correspondente a um comportamento testável (ex.: `POST /api/inbox/conversations/:id/messages` bloqueia envio quando WhatsApp desconectado).

1. **Red** — escrever o teste *primeiro*. Executar `bun --bun run test` (client) ou `bun test` (server). O teste MUST falhar pela razão certa (ex.: 404 porque a rota ainda não existe; não falhar por typo/import).
2. **Green** — escrever o mínimo de código para o teste passar. Nada de funcionalidade extra.
3. **Refactor** — com o teste verde, limpar nomes, remover duplicação, clarificar. Testes continuam verdes em cada passo.
4. **Commit** — um commit por unidade quando possível (ou agrupando Red+Green+Refactor). Mensagem descreve o comportamento, não o mecanismo.

Excepções explícitas (Princípio III):

- Glue code trivial (wiring de módulos, pass-through de props, re-exports) dispensa teste.
- UI meramente declarativa (um componente que só chama `daisyui` e passa children) dispensa teste de snapshot por si só — é testada indirectamente pelo teste de comportamento do feature.

### Pirâmide de testes para esta feature

```
           ┌──────────────────────┐
           │  2.  E2E (Playwright)│   mínimo; 1–2 happy paths (login → enviar msg)
           │       (opcional MVP) │
      ┌────┴──────────────────────┴────┐
      │ 3.  Route / Integration         │   server Hono + Supabase (in-proc test client)
      │      (Hono app.request)         │   client features com MSW
      └─────────────────────────────────┘
┌────────────────────────────────────────────┐
│ 4.  Unit                                   │   maior volume
│      (pure funcs, reducers, mappers,       │
│       zod schemas, rate-limiter,           │
│       webhook parser, pipeline ordering)   │
└────────────────────────────────────────────┘
```

- **Unit** cobre lógica pura. ~70% das asserções.
- **Route / Integration** cobre handlers HTTP + middleware + mapeamento para a DB (com Supabase client mockado). ~25%.
- **E2E** é opcional na MVP; se implementado, corre localmente com o stack completo contra um Supabase de dev e a uazapi em `free.uazapi.com`. ~5%.

Ver lista concreta de testes em [`contracts/test-strategy.md`](./contracts/test-strategy.md).

### Estratégia de doubles (o que mockar, o que não mockar)

| Dependência | Unit | Route/Integration | E2E |
| --- | --- | --- | --- |
| `@supabase/supabase-js` | mock inteiro (stub das funções usadas) | mock com respostas pré-definidas; OU Supabase local opcional | Supabase real (projecto de dev) |
| uazapi HTTP API | `fetch` mockado (`vi.stubGlobal('fetch', …)`) com respostas do spec OpenAPI | mesmo | uazapi real (`free.uazapi.com`), instância de teste |
| Webhook da uazapi → nosso server | payloads fixture em `server/lib/whatsapp/__fixtures__/` replicando exemplos do spec | payloads fixture enviados via `app.request()` | QR real + telemóvel externo envia msg |
| Supabase Realtime (client) | mock do `channel().on().subscribe()` | MSW intercepta WebSocket (se necessário) ou mock directo | real |
| JWT Supabase (server auth middleware) | gerar HS256 dev token com `SUPABASE_JWT_SECRET` de teste | idem | JWT real emitido pelo Supabase Auth |

Regra geral: **mockar nos limites**, não entre camadas internas. Reducers de pipeline, mappers de webhook, validação de segredo, rate-limiter — tudo testado directamente sem mocks.

### Test doubles & fixtures partilhados

- `server/test/fixtures/jwts.ts` — helpers para emitir JWTs de teste com um `SUPABASE_JWT_SECRET` fixo (`test-secret`).
- `server/test/fixtures/supabase.ts` — factory de mock de `@supabase/supabase-js` com API encadeável (`.from().select().eq()…`).
- `server/lib/whatsapp/__fixtures__/uazapi-events.ts` — payloads JSON fixture para cada tipo de evento (`messages`, `messages_update`, `connection`) extraídos do spec OpenAPI + casos reais capturados.
- `client/src/test/setup.ts` — setup Vitest global: `@testing-library/jest-dom`, mock de `window.matchMedia`, MSW server handlers padrão.
- `client/src/test/msw/` — handlers MSW para cada grupo de endpoints.

### Gates de validação (bloqueantes para merge)

Além dos gates já listados em "Development Workflow & Quality Gates" da constituição:

1. `bun test` (server) devolve green.
2. `bun --bun run test` (client) devolve green.
3. Para qualquer ficheiro novo em `server/routes/*.ts`, `server/lib/whatsapp/*.ts`, `server/middlewares/*.ts` ou `client/src/features/*/` existir o ficheiro correspondente `*.test.ts(x)`. Se não existir, o PR description MUST justificar (ex.: "glue code — sem lógica testável"). A verificação é manual no review (não há lint rule para isto na MVP).
4. Bug fixes incluem teste de regressão que falha sem o fix (Princípio III).
5. Teste novo descoberto só-falso (passou antes do código existir) → marcar `it.fails()` até o código estar escrito; não commitar `it.skip()` como disfarce de TDD.

### Pre-commit hook (recomendado)

Um hook de pre-commit em `.husky/pre-commit` (ou equivalente) a executar em sequência:

```sh
# 1. lint dos ficheiros staged (só client)
cd client && bun --bun run lint

# 2. type-check incremental
cd client && bun --bun tsc --noEmit
(cd .. && bun --bun tsc --noEmit -p tsconfig.json)

# 3. testes dos workspaces tocados
# (simplificação MVP: correr tudo)
bun test && cd client && bun --bun run test
```

Husky é opcional na MVP; a alternativa é confiar no runner de CI. Ver `quickstart.md` para setup completo.

### Definition of Done (por task)

Uma tarefa do `tasks.md` só é marcada `[x]` quando:

- [ ] O comportamento está implementado no código.
- [ ] O(s) teste(s) correspondentes estão a correr green.
- [ ] Não foram desligadas asserções para passar (`skip`, `fails`, `todo` não aparecem no diff).
- [ ] Se é rota/handler novo, existe pelo menos um teste que exercita o caminho feliz + um negativo (401/403/409/429 conforme aplicável).
- [ ] Se é mapper/reducer/pure func, existe pelo menos um teste por ramo lógico identificado.
- [ ] `bun test` (server) e `bun --bun run test` (client) passam na branch.

## Phase 1 Re-check — Constitution Gate (pós-design)

Executado depois de gerar `research.md` + `data-model.md` + `contracts/` + `quickstart.md`:

| Princípio | Estado | Nota |
| --- | --- | --- |
| I. Workspace Independence | ✅ | Única coupling: `client` → `server/types/` via path alias. Declarada explicitamente no tsconfig/vite config. |
| II. Type Safety & Strict TS | ✅ | Zod schemas em `server/types/*` fornecem tipos via `z.infer`. |
| III. Test-First | ✅ | Workflow TDD Red-Green-Refactor detalhado em "Development Approach (TDD)" acima; lista completa de testes em [`contracts/test-strategy.md`](./contracts/test-strategy.md); Definition of Done por tarefa bloqueia merge sem testes a passar. |
| IV. Conventions as Code | ✅ | Sem alterações às configs de lint/format. |
| V. Simplicity & YAGNI | ✅ | Nenhum endpoint, tabela ou entidade adicionada além do necessário para as 5 user stories. |
| VI. Multi-Tenant Isolation & Secret Hygiene | ✅ | RLS policies definidas em `data-model.md`; endpoints protegidos por middleware auth + tenant-guard. |

**Resultado do re-gate**: **PASS**.

## Complexity Tracking

> Sem violações a rastrear.

## Open items carried over (to confirm post-plan)

Estas decisões foram tomadas em `research.md` para desbloquear o plano, mas correspondem a pontos de ambiguidade identificados no `/speckit-clarify` interrompido. Recomenda-se validação pelo utilizador antes de `/speckit-tasks`:

1. **Modelo de papéis**: assumido `owner` + `agent` (Opção B da clarify). Owners editam pipeline, gerem utilizadores e conexão WhatsApp; agents têm só inbox/reply/pipeline-move.
2. **Rate limit de envio**: default 20 msg/min e 1000 msg/dia por tenant, HTTP 429 + retry-after quando excedido; configurável por tenant em follow-up.
3. **Deleção de dados (baseline RGPD)**: MVP expõe acção "apagar lead" ao owner com cascade para conversation + messages. Políticas automáticas de retenção ficam fora da MVP.
