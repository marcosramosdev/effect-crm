---
description: "Tasks for implementing User Authentication & Routing /app/* /auth/* /"
---

# Tasks: Autenticação de Utilizadores e Roteamento `/app/*` · `/auth/*` · `/`

**Input**: Design documents from `/specs/002-user-auth-routing/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, contracts/auth.md

**Tests**: TDD obrigatório (cf. user prompt + Princípio III). Toda a lógica não-trivial tem teste RED **antes** da implementação.

**Organization**: tarefas agrupadas por user story para entrega incremental e testável.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (ficheiros distintos, sem dependências em tarefas incompletas)
- **[Story]**: US1–US5 (cf. spec.md)
- Caminhos de ficheiro absolutos a partir do repo root

## Path Conventions

- Server: `server/`
- Client: `client/src/`
- Specs: `specs/002-user-auth-routing/`

---

## Phase 1: Setup (Refactor de rotas existentes)

**Purpose**: mover rotas da feature 001 para sob `/app/*` antes de qualquer trabalho novo. Sem mudanças de comportamento — só relocação.

- [X] T001 Mover `client/src/routes/connect.tsx` → `client/src/routes/app/connect.tsx`; ajustar `Route = createFileRoute('/connect')` para `'/app/connect'`
- [X] T002 Mover `client/src/routes/inbox/index.tsx` e `client/src/routes/inbox/$conversationId.tsx` → `client/src/routes/app/inbox/index.tsx` e `client/src/routes/app/inbox/$conversationId.tsx`; ajustar paths em `createFileRoute`
- [X] T003 Mover `client/src/routes/pipeline/index.tsx` → `client/src/routes/app/pipeline/index.tsx`; ajustar path
- [X] T004 Mover `client/src/routes/settings/pipeline.tsx` e `client/src/routes/settings/team.tsx` → `client/src/routes/app/settings/pipeline.tsx` e `client/src/routes/app/settings/team.tsx`; ajustar paths
- [X] T005 Procurar e substituir todas as referências a `to: '/inbox'`, `to: '/pipeline'`, `to: '/connect'`, `to: '/settings/...'` em `client/src/` por `'/app/inbox'`, `'/app/pipeline'`, `'/app/connect'`, `'/app/settings/...'` (busca global em `.tsx`/`.ts`)
- [X] T006 [P] Verificar `client/src/routeTree.gen.ts` regenera após mudanças (correr `bun --bun run dev` uma vez para deixar plugin actualizar) e confirmar que não há paths órfãos

**Checkpoint**: `bun --bun run dev` em `client/` arranca sem erro. `bun --bun run build` passa. Suite de testes existente continua a passar (com paths actualizados nos testes — cobertos em US1–US5).

---

## Phase 2: Foundational (Schemas + libs partilhadas + skeletons)

**Purpose**: infraestrutura partilhada que TODAS as user stories vão usar. Bloqueia US1–US5.

**⚠️ CRITICAL**: Nenhum trabalho de US1–US5 começa antes desta fase concluir.

### Schemas Zod partilhados

- [X] T007 Criar `server/types/auth.ts` com `RegisterRequestSchema`, `LoginRequestSchema`, `LogoutRequestSchema`, `AuthSessionSchema`, `MeResponseSchema`, `AuthErrorCodeSchema`, `AuthErrorBodySchema` + tipos derivados (cf. data-model.md §"Schemas Zod")
- [X] T008 [P] Confirmar alias `@server/types/*` em `client/tsconfig.json` resolve para `../server/types/*`; se não, adicionar (Princípio Tech Constraints — paths em tsconfig é a fonte de verdade)

### Error mapping (TDD)

- [X] T009 Criar `server/lib/auth/error-mapping.test.ts` com casos para cada linha da tabela em research.md §R6: `invalid_grant`, `user_not_found`, `email_exists`, `weak_password`, `tenant_name_invalid`, 429, `unknown` — verificar status, code e mensagem PT (RED)
- [X] T010 Implementar `server/lib/auth/error-mapping.ts` — função `mapSupabaseError(err: unknown): { httpStatus: number; code: AuthErrorCode; message: string }` para fazer T009 passar (GREEN)

### Skeletons de routing (sem implementação completa de guard ainda)

- [X] T011 Criar `client/src/routes/app.tsx` — `createFileRoute('/app')` com `beforeLoad` que faz `await context.queryClient.ensureQueryData(authQueryOptions)`; em catch faz `throw redirect({ to: '/auth/login', search: { redirect: location.href } })` (cf. contracts/auth.md). Componente expõe `<Outlet/>` num layout simples (placeholder para `<UserMenu/>` em US4)
- [X] T012 [P] Criar `client/src/routes/auth.tsx` — `createFileRoute('/auth')` com `beforeLoad` inverso: ensureQueryData success → `throw redirect({ to: '/app' })`; em catch (sessão inválida) deixa cair para children. Componente layout centra cards
- [X] T013 [P] Criar `client/src/routes/app/index.tsx` — redirect default para `/app/inbox` (ou `/app/connect` se owner sem WhatsApp ligado, replicando lógica antiga de `routes/index.tsx`)

### apiFetch refactor (FR-022 + research R10)

- [X] T014 Criar `client/src/lib/__tests__/api.test.ts` com asserção: ao receber 401, `apiFetch` chama `supabase.auth.signOut({ scope: 'local' })` (não modo global) e lança `Error('Unauthorized')` (RED)
- [X] T015 Modificar `client/src/lib/api.ts` — substituir `supabase.auth.signOut()` (linha actual ~33) por `supabase.auth.signOut({ scope: 'local' })`; fazer T014 passar (GREEN)

**Checkpoint**: `bun --bun run test` no client e server passa. `RegisterRequestSchema` importável tanto do server (`server/types/auth.ts`) como do client (via alias). `app.tsx` e `auth.tsx` existem mas ainda sem rotas filhas implementadas.

---

## Phase 3: User Story 1 — Homepage pública (Priority: P1) 🎯 MVP

**Goal**: visitante anónimo abre `/` e vê uma homepage pública com CTAs "Entrar" e "Criar conta". Visitante autenticado é redireccionado para `/app`.

**Independent Test**: abrir `/` em janela anónima → renderiza HomePage; sem chamadas autenticadas no Network. Em janela autenticada → redirect imediato para `/app`.

### Tests for User Story 1 (TDD)

- [X] T016 [P] [US1] Estender `client/src/routes/__tests__/guard.test.tsx`: cenários "/ sem sessão renderiza HomePage" e "/ com sessão redireciona para /app" (RED)

### Implementation for User Story 1

- [X] T017 [P] [US1] Criar `client/src/features/auth/HomePage.tsx` — componente DaisyUI com hero (nome do produto + tagline), dois botões `<Link to="/auth/login">` e `<Link to="/auth/register">` (FR-005); sem `useQuery` autenticado (FR-006)
- [X] T018 [US1] Reescrever `client/src/routes/index.tsx` — `createFileRoute('/')` com `beforeLoad` que tenta `ensureQueryData(authQueryOptions)`; em sucesso `throw redirect({ to: '/app' })`; em catch deixa renderizar `HomePage`. Importar `HomePage` de `@/features/auth/HomePage`
- [X] T019 [US1] Correr `bun run test` em `client/` — confirmar T016 passa (GREEN)

**Checkpoint**: US1 funcional e independentemente testável. SC-007 verificável manualmente (`/` carrega <3s sem cache, sem chamadas autenticadas).

---

## Phase 4: User Story 2 — Registo auto-serviço (Priority: P1)

**Goal**: visitante cria conta em `/auth/register`, sistema cria tenant + member (role=owner) atomicamente, sessão fica activa, redirect para `/app`.

**Independent Test**: cf. quickstart.md §"Cenário 2".

### Tests for User Story 2 (TDD)

- [X] T020 [P] [US2] Criar `server/lib/auth/register.test.ts` — caminho feliz cria user+tenant+member; falha em insert tenants → user removido; falha em insert tenant_members → user e tenant removidos; email duplicado → 409 sem side-effects; tenantName inválido → 400 sem chamar Supabase (RED)
- [X] T021 [P] [US2] Criar `server/routes/__tests__/auth.register.test.ts` (ou estender `server/routes/auth.test.ts`) — wiring HTTP: 201 retorna `AuthSessionSchema`; 400 `WEAK_PASSWORD`; 400 `TENANT_NAME_INVALID`; 409 `EMAIL_EXISTS_OR_INVALID`; 429 `RATE_LIMITED`; bodies de erro batem em `AuthErrorBodySchema` (RED)
- [X] T022 [P] [US2] Criar `client/src/features/auth/__tests__/useRegisterMutation.test.ts` — mutation envia `{email, password, tenantName}` no body; onSuccess invoca `supabase.auth.setSession(...)` + `queryClient.invalidateQueries(['auth','me'])` + `router.navigate({ to: '/app' })`; onError preserva form values (RED)

### Implementation for User Story 2

- [ ] T023 [US2] Implementar `server/lib/auth/register.ts` — função `registerOwner({ email, password, tenantName }, deps)` que executa: `admin.createUser` → insert `tenants` → insert `tenant_members(role='owner')` → `auth.admin.signInWithEmail` para gerar tokens. Rollback compensatório em falha (cf. research R3). Retorna `AuthSession`. Fazer T020 passar (GREEN)
- [ ] T024 [US2] Adicionar handler `POST /register` em `server/routes/auth.ts`: `app.post('/register', zValidator('json', RegisterRequestSchema), async (c) => { ... })`. Chama `registerOwner`; em sucesso 201; em erro mapeia via `mapSupabaseError`. Fazer T021 passar (GREEN)
- [ ] T025 [P] [US2] Criar `client/src/features/auth/useRegisterMutation.ts` — `useMutation` que chama `apiFetch('/auth/register', { method: 'POST', body, schema: AuthSessionSchema })`; `onSuccess` segue contracts/auth.md §"Registo". Fazer T022 passar (GREEN)
- [ ] T026 [US2] Criar `client/src/features/auth/RegisterScreen.tsx` — form RHF + Zod resolver com `RegisterRequestSchema`; campos email/password/tenantName; submete via `useRegisterMutation`; mostra erros field-level (FR-007); link para `/auth/login`
- [ ] T027 [US2] Criar `client/src/routes/auth/register.tsx` — `createFileRoute('/auth/register')`; componente = `RegisterScreen`. (Guard de "se sessão → /app" herdado de `auth.tsx`)

**Checkpoint**: registo end-to-end funciona. Validar com cenário 2 do quickstart.md.

---

## Phase 5: User Story 3 — Login (Priority: P1)

**Goal**: utilizador existente faz login em `/auth/login` e chega ao app. Se entrou via deep link protegido, é levado de volta para esse link após login.

**Independent Test**: cf. quickstart.md §"Cenário 3".

### Tests for User Story 3 (TDD)

- [ ] T028 [P] [US3] Estender `server/routes/auth.test.ts` (ou novo `auth.login.test.ts`) — handler `POST /login`: 200 `AuthSession` para credenciais válidas; 401 `INVALID_CREDENTIALS` para email inexistente; 401 `INVALID_CREDENTIALS` para senha errada (mesma resposta); 401 `INVALID_CREDENTIALS` para email mal-formado (NÃO 400 — uniformiza); 429 `RATE_LIMITED` (RED)
- [ ] T029 [P] [US3] Criar `client/src/features/auth/__tests__/useLoginMutation.test.ts` — mutation envia `{email, password}`; onSuccess invoca `setSession`+`invalidate`+`router.navigate`; quando há `search.redirect` no router, navega para essa URL em vez de `/app`; onError preserva email no form mas limpa password (RED)

### Implementation for User Story 3

- [ ] T030 [US3] Adicionar handler `POST /login` em `server/routes/auth.ts`: usa cliente Supabase com `SUPABASE_ANON_KEY` para `signInWithPassword`; em qualquer falha de credenciais devolve 401 `INVALID_CREDENTIALS` (uniforme); usa `mapSupabaseError` para 429/UNKNOWN. Fazer T028 passar (GREEN)
- [ ] T031 [P] [US3] Criar `client/src/features/auth/useLoginMutation.ts` — `useMutation`; `onSuccess` lê `Route.useSearch().redirect` (passar via parâmetro do hook se necessário) e navega para essa URL ou `/app`. Fazer T029 passar (GREEN)
- [ ] T032 [US3] Criar `client/src/features/auth/LoginScreen.tsx` — form RHF + Zod com `LoginRequestSchema`; mostra erro genérico ("Email ou senha inválidos.") sem field-level distinction em 401; link para `/auth/register`
- [ ] T033 [US3] Criar `client/src/routes/auth/login.tsx` — `createFileRoute('/auth/login')` com `validateSearch: z.object({ redirect: z.string().optional() })`; componente lê search e passa a `LoginScreen` (que passa a `useLoginMutation`)

**Checkpoint**: login com return-to funciona. Cenário 3 do quickstart valida.

---

## Phase 6: User Story 4 — Logout (Priority: P2)

**Goal**: utilizador autenticado encontra "Sair" em qualquer ecrã do app; ao accionar, sessão termina e volta a `/`.

**Independent Test**: cf. quickstart.md §"Cenário 4".

### Tests for User Story 4 (TDD)

- [ ] T034 [P] [US4] Estender `server/routes/auth.test.ts` (ou `auth.logout.test.ts`) — handler `POST /logout`: 204 com Bearer válido; 204 idempotente quando token já revogado; 401 quando sem header (RED)
- [ ] T035 [P] [US4] Criar `client/src/features/auth/__tests__/useLogoutMutation.test.ts` — mutation chama `apiFetch('/auth/logout', POST)`; onSuccess invoca `supabase.auth.signOut({ scope: 'local' })` + `queryClient.clear()` + `router.navigate({ to: '/' })`; onError com 401 ainda executa as três acções (idempotência client-side) (RED)

### Implementation for User Story 4

- [ ] T036 [US4] Adicionar handler `POST /logout` em `server/routes/auth.ts` (autenticado via middleware existente): chama `supabase.auth.admin.signOut(jwt)`; devolve 204 mesmo se Supabase responder erro de "already revoked". Fazer T034 passar (GREEN)
- [ ] T037 [P] [US4] Criar `client/src/features/auth/useLogoutMutation.ts` — segue contracts/auth.md §"Logout". Fazer T035 passar (GREEN)
- [ ] T038 [US4] Criar `client/src/features/shell/UserMenu.tsx` — dropdown DaisyUI mostrando email + role; botão "Sair" chama `useLogoutMutation`
- [ ] T039 [US4] Modificar `client/src/routes/app.tsx` — montar `<UserMenu/>` no header do layout (visível em todas as rotas `/app/*`)

**Checkpoint**: logout funciona em qualquer ecrã do app. Browser-back após logout não permite continuar (cf. spec edge case).

---

## Phase 7: User Story 5 — Gating completo + 404 (Priority: P2)

**Goal**: garantir que toda a matriz de gating (URL × sessão) cai no ecrã esperado, sem flash, sem ciclos.

**Independent Test**: cf. quickstart.md §"Cenário 5" — matriz fixa de URLs.

### Tests for User Story 5 (TDD)

- [ ] T040 [P] [US5] Estender `client/src/routes/__tests__/guard.test.tsx` com a matriz completa: `/` ±sessão; `/auth/login` ±sessão; `/auth/register` ±sessão; `/app/inbox` ±sessão (verifica search.redirect preservado); `/app/foo-inexistente`; `/qualquer-coisa` (RED para os casos que ainda não passam)

### Implementation for User Story 5

- [ ] T041 [US5] Refinar `beforeLoad` em `client/src/routes/app.tsx`: garantir que `location.href` (não só `pathname`) é guardado em `search.redirect` para preservar query strings; tratar erro vs. redirect throw distintamente (cf. contracts/auth.md)
- [ ] T042 [US5] Refinar `beforeLoad` em `client/src/routes/auth.tsx`: distinguir `redirect`-throw (propagar) de erro de auth (deixar cair); cobrir o caso de erro de rede
- [ ] T043 [US5] Implementar `notFoundComponent` global em `client/src/routes/__root.tsx` (substituir `notFoundComponent` actual por algo coerente com o resto da UI; não revela se URL era sob `/app/*` ou outra)
- [ ] T044 [US5] Correr `bun --bun run test` em `client/` — confirmar T040 passa por inteiro (GREEN)

**Checkpoint**: SC-003 e SC-004 verificáveis (100% das transições caem no esperado). Quickstart §Cenário 5 passa.

---

## Phase 8: Polish & Cross-Cutting

- [ ] T045 [P] Actualizar `client/CLAUDE.md` — refletir novo prefixo `/app/*` e existência de `/auth/*` no parágrafo de Routing
- [ ] T046 [P] Actualizar `server/CLAUDE.md` — adicionar nota sobre endpoints `/api/auth/{register,login,logout}` em "Autenticação"
- [ ] T047 [P] Correr `bun --bun run check` em `client/` (lint + typecheck + format) — zero erros (Princípio IV)
- [ ] T048 [P] Correr `bun run test` em ambos workspaces — toda a suite verde (Princípio III + user prompt 002)
- [ ] T049 Validar quickstart.md ponta-a-ponta em browser real (Cenários 1–5) — registar resultado em PR description
- [ ] T050 [P] Refactor: simplificar duplicação entre `LoginScreen` e `RegisterScreen` em `client/src/features/auth/` — extrair `<AuthFormShell>` se útil (mas só se três linhas similares se justificarem — Princípio V)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup / refactor de rotas)**: sem dependências — começa imediatamente
- **Phase 2 (Foundational)**: depende da Phase 1 — bloqueia US1–US5
- **Phase 3 (US1)**: depende da Phase 2 — independente das outras stories
- **Phase 4 (US2)**: depende da Phase 2 — independente da US1/US3/US4/US5
- **Phase 5 (US3)**: depende da Phase 2 — independente da US1/US2; recomenda-se após US2 só para reaproveitar testes de mutation patterns, mas não é dependência hard
- **Phase 6 (US4)**: depende da Phase 2; pode integrar mais cedo se layout `app.tsx` da Phase 2 estiver pronto
- **Phase 7 (US5)**: depende de US1–US4 (precisa de todos os ecrãs para validar a matriz completa)
- **Phase 8 (Polish)**: depende de US1–US5 completas

### User Story Dependencies (lógicas)

- **US1**: nenhuma — qualquer trabalho da Phase 2 chega
- **US2**: precisa de Phase 2 (schemas + register lib stub + error-mapping)
- **US3**: precisa de Phase 2 (schemas + error-mapping); benefícia de US2 estar feito (mesmo padrão de mutation)
- **US4**: precisa de Phase 2 + de `app.tsx` montado (vem da Phase 2 T011)
- **US5**: precisa de US1+US2+US3+US4 para validar a matriz completa

### Within Each User Story

- Testes (TDD) **antes** da implementação — todos os T0xx marcados "RED" são write-first
- `models/` (Zod schemas) **antes** de services
- Services (`server/lib/auth/*`) **antes** de routes (`server/routes/auth.ts`)
- Server routes **antes** de client mutations
- Client mutations **antes** de screens
- Screens **antes** de route files
- Story completa antes de passar para próxima prioridade

### Parallel Opportunities

- Todas as tarefas marcadas [P] dentro da mesma fase podem rodar em paralelo (ficheiros distintos)
- Em Phase 2: T008, T009, T010, T011/T012/T013, T014/T015 — várias correm em paralelo
- Em US2/US3/US4: os 3 testes RED iniciais ([P]) correm em paralelo, depois implementações em paralelo onde marcado [P]

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Após T007 (schemas) concluir, lançar em paralelo:
Task: "T009 RED tests para error-mapping (server/lib/auth/error-mapping.test.ts)"
Task: "T011 Criar app.tsx skeleton (client/src/routes/app.tsx)"
Task: "T012 Criar auth.tsx skeleton (client/src/routes/auth.tsx)"
Task: "T013 Criar app/index.tsx redirect (client/src/routes/app/index.tsx)"
Task: "T014 RED test apiFetch 401 (client/src/lib/__tests__/api.test.ts)"
```

## Parallel Example: User Story 2

```bash
# Após Phase 2 concluir, três testes RED em paralelo:
Task: "T020 register.test.ts RED"
Task: "T021 routes/auth.register.test.ts RED"
Task: "T022 useRegisterMutation.test.ts RED"

# Depois implementações em paralelo onde marcado [P]:
Task: "T025 useRegisterMutation.ts"  # [P] em paralelo com T026
Task: "T026 RegisterScreen.tsx"      # [P]
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

Spec marca US1, US2 e US3 como P1. Sem auto-registo nem login, não há produto. Caminho:

1. Phase 1 (refactor rotas)
2. Phase 2 (foundational)
3. Phase 3 (US1 — homepage) — entrega visível
4. Phase 4 (US2 — registo)
5. Phase 5 (US3 — login)
6. **STOP & VALIDATE**: Cenários 1, 2, 3 do quickstart passam → MVP demo-ready

### Incremental Delivery

1. Setup + Foundational → fundação pronta
2. US1 → primeiro deploy visível (homepage pública)
3. US2 → onboarding funciona; tenants podem registar-se
4. US3 → utilizadores recorrentes entram
5. US4 → higiene de sessão (computadores partilhados)
6. US5 → polimento de gating + 404
7. Polish → docs + lint + quickstart manual

### Parallel Team Strategy

Com 2 devs:

- Setup + Foundational: ambos juntos (mexe em ficheiros base; coordenar T011/T012/T013)
- Após Phase 2: dev A faz US1+US3, dev B faz US2+US4 (caminhos disjuntos)
- US5 + Polish: ambos juntos para validar end-to-end

---

## Notes

- **TDD obrigatório** (Princípio III + user prompt 002): nenhum commit de implementação antes do teste correspondente existir e estar RED. Marca-se "GREEN" no commit que faz o teste passar.
- **[P]** = ficheiros distintos, sem dependências em incomplete tasks da mesma fase
- **[Story]** mapeia tarefa a US para rastreabilidade
- Cada user story deve ser independentemente completável e testável
- Verificar que testes falham antes de implementar
- Commit após cada tarefa ou grupo lógico (Princípio Dev Workflow §"Commits")
- Stop em cada checkpoint para validar story isoladamente
- Evitar: tarefas vagas, conflitos de mesmo ficheiro, dependências cruzadas que quebram independência das stories
- **Sem novas migrações SQL** — reutiliza `tenants` e `tenant_members` da feature 001
- **Sem novas dependências** — toda a stack já está instalada (cf. plan.md §Technical Context)
