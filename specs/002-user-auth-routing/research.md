# Phase 0 — Research: Auth & Routing (Spec 002)

Documenta decisões tomadas para resolver pontos abertos da spec antes de Phase 1.

---

## R1 — Modelo de registo (FR-010)

**Pergunta**: registo público cria novo tenant, ou só funciona por convite?

**Decisão**: **Auto-serviço cria novo tenant** (Opção A da Q1).

- `/auth/register` está aberto a qualquer visitante.
- Form pede `email` + `password` + `nome da empresa` (= `tenant.name`).
- O server cria `auth.users` row, `tenants` row, e `tenant_members` row com `role='owner'`, atomicamente.
- O fluxo de "owner convida agente" continua a viver no team management já implementado na feature 001 (não passa por `/auth/register`).

**Rationale**: alinha com a intenção do user prompt ("criar conta" como primeira página de auth) e com o B2B-trial pattern. Sem necessidade de provisionamento manual de tenants. Risco de spam é gerível (mitigado por rate limit do Supabase Auth + verificação de email opcional configurada server-side, fora do âmbito desta spec).

**Alternativas consideradas**:

- *Convite-only*: rejeitado — exige provisionamento out-of-band para o **primeiro** owner de cada tenant; criaria uma feature paralela só para isso.
- *Híbrido (auto-serviço + convite)*: rejeitado — duplica complexidade do form e gating sem ganho material para a MVP.

---

## R2 — "Sempre referido ao backend" vs Princípio VI

**Pergunta**: o user pediu que toda a auth seja feita via backend. Mas o Princípio VI (NON-NEGOTIABLE) diz que o server **NÃO** mantém sessão paralela ao Supabase. Como conciliar?

**Decisão**: o server actua como **proxy fino** ao Supabase Auth. Endpoints `/api/auth/*` recebem o pedido do client, invocam o Supabase Auth no server, e devolvem ao client os **mesmos tokens Supabase** (`access_token` + `refresh_token`). O client guarda esses tokens via `supabase.auth.setSession({ access_token, refresh_token })` e, daí em diante, `apiFetch` continua a usar `supabase.auth.getSession()` para obter o `Authorization: Bearer`.

- **Não há sessão própria do server** — não há cookie HTTP-only emitido pelo server, não há row de "sessions" em Postgres, não há minting de JWT próprio.
- **Há gateway server** — o client nunca chama `supabase.auth.signInWithPassword`/`signUp`/`signOut` directamente. Sempre passa por `/api/auth/login`/`/api/auth/register`/`/api/auth/logout`. Isto é o que satisfaz o user prompt.

**Rationale**: a leitura literal do Princípio VI é "não montar uma camada de sessão própria paralela ao Supabase" (`MUST NOT mint or maintain its own session/cookie auth layer in parallel with Supabase`). Proxiar a chamada não viola — os tokens permanecem Supabase tokens. Esta interpretação foi explicitamente verificada contra o texto da constituição em `.specify/memory/constitution.md` (linhas 138–141).

**Alternativas consideradas**:

- *Client chama Supabase directamente para login/register*: rejeitado — viola "sempre referido ao backend" pedido pelo user.
- *Server emite JWTs próprios (HS256 internos)*: rejeitado — viola Princípio VI.
- *Server emite cookies HTTP-only com tokens Supabase*: rejeitado para esta spec — adiciona complexidade (CSRF protection, decisão de domínio para cookies cross-subdomain) sem necessidade. `setSession` no client é suficiente.

---

## R3 — Atomicidade do registo (R1 + Princípio VI)

**Pergunta**: como garantir que `auth.users` + `tenants` + `tenant_members` ficam consistentes mesmo em falha parcial?

**Decisão**: ordem definida em `server/lib/auth/register.ts`:

1. `supabase.auth.admin.createUser({ email, password })` (service-role).
2. Se sucesso → `db.from('tenants').insert({ name: tenantName })` (service-role).
3. Se sucesso → `db.from('tenant_members').insert({ tenant_id, user_id, role: 'owner' })` (service-role).
4. Se 2 ou 3 falharem → **rollback compensatório**: `auth.admin.deleteUser(userId)` + (se 3 falhou) `db.from('tenants').delete().eq('id', tenant_id)`.

**Rationale**: `auth.users` está num schema gerido pelo Supabase; não há transação Postgres que envolva `auth.*` + `public.*`. Compensação é a única opção.

**Alternativas consideradas**:

- *RPC Postgres `register_owner(email, password, tenant_name)`*: rejeitado — exige a função aceder a `auth.users` com privilégios admin, o que arrasta complexidade SQL para uma operação rara (registo). Mais simples no Bun.
- *Fila idempotente*: over-engineered para um único path de bootstrap.

**Cobertura de teste (TDD)**:

- ✅ caminho feliz devolve `AuthSession` válido + linhas criadas.
- ✅ falha em (2) → user removido, sem tenant criado.
- ✅ falha em (3) → user removido, tenant removido.
- ✅ email duplicado → `409 EMAIL_EXISTS_OR_INVALID` sem criar nada.
- ✅ tenant_name vazio/curto → `400 TENANT_NAME_INVALID` (Zod) antes de tocar Supabase.

---

## R4 — TanStack Router guards: `beforeLoad` vs render-time check

**Pergunta**: como garantir FR-019 (sem flash de UI protegida)?

**Decisão**: usar `beforeLoad` em rota-pai. TanStack Router resolve `beforeLoad` antes de montar componentes filhos.

- `app.tsx`: `beforeLoad: async ({ context, location }) => { try { await context.queryClient.ensureQueryData(authQueryOptions) } catch { throw redirect({ to: '/auth/login', search: { redirect: location.pathname } }) } }`
- `auth.tsx`: `beforeLoad: async ({ context }) => { try { await context.queryClient.ensureQueryData(authQueryOptions); throw redirect({ to: '/app' }) } catch (e) { if (e instanceof Error) throw e /* propagate redirect */ /* sem sessão → cair para children */ } }`
- `index.tsx` (homepage): `beforeLoad` semelhante a `auth.tsx` — se sessão válida, redirect para `/app`.

**Pormenor**: `authQueryOptions.queryFn` chama `/api/auth/me` que devolve 401 sem sessão; `ensureQueryData` rejeita; o catch dispara o redirect. Isto garante que o conteúdo de `/app/*` **nunca** monta sem `me` resolvido.

**Rationale**: alternativa render-time (`if (!auth) return <Spinner/>`) introduz flicker. `beforeLoad` é o idiomatic TanStack Router para gating.

**Cobertura de teste (TDD)**: `client/src/routes/__tests__/guard.test.tsx` já existe (feature 001) e cobre o redirect actual de `/`. Amplia-se para:

- `/app/inbox` sem sessão → redirect `/auth/login?redirect=/app/inbox`.
- `/auth/login` com sessão → redirect `/app`.
- `/` sem sessão → renderiza `HomePage` (sem redirect).
- `/` com sessão → redirect `/app`.

---

## R5 — Mitigação de força bruta (FR-021)

**Decisão**: delegar ao Supabase Auth, que aplica rate limit nativo por IP (`auth_rate_limit` config, default 30 req/h por endpoint). O server não duplica.

**Rationale**: Princípio V (YAGNI). Reimplementar limit é trabalho duplicado e inferior. Documentamos a dependência: ops do Supabase definem o limite final.

**Alternativa**: middleware Hono com token-bucket por IP. Rejeitado para a MVP. Pode ser adicionado depois numa feature de "anti-abuse".

---

## R6 — Mensagens uniformes (FR-008, FR-011)

**Decisão**: módulo `server/lib/auth/error-mapping.ts` exporta `mapSupabaseError(err): { httpStatus, code, message }` com tabela fixa:

| Supabase signal | code (canónico) | HTTP | mensagem PT |
|---|---|---|---|
| `invalid_grant` (login) | `INVALID_CREDENTIALS` | 401 | "Email ou senha inválidos." |
| `user_not_found` (login) | `INVALID_CREDENTIALS` | 401 | "Email ou senha inválidos." |
| `email_exists` (register) | `EMAIL_EXISTS_OR_INVALID` | 409 | "Não foi possível criar a conta com este email." |
| `weak_password` (register) | `WEAK_PASSWORD` | 400 | "Senha não cumpre os requisitos mínimos." |
| (nosso) tenant name 2..80 fail | `TENANT_NAME_INVALID` | 400 | "Nome da empresa inválido (2–80 caracteres)." |
| 429 do Supabase | `RATE_LIMITED` | 429 | "Demasiadas tentativas. Tenta novamente mais tarde." |
| outro | `UNKNOWN` | 500 | "Erro inesperado. Tenta novamente." |

**Rationale**: distingue 401 de "credenciais inválidas" (não revela se email existe — FR-011) de 409 em registo (necessariamente revela algo, mas a mensagem é deliberadamente ambígua entre "email existe" e "email inválido"). FR-008 satisfeito.

**Cobertura de teste**: matriz fixa, fácil de cobrir em `error-mapping.test.ts` com exemplos de cada signal.

---

## R7 — Logout: revoga refresh token ou só limpa client?

**Decisão**: `POST /api/auth/logout` invoca `supabase.auth.admin.signOut(jwt)` para invalidar o refresh token server-side, e o client limpa a sessão local via `supabase.auth.signOut()` (modo `local`, sem chamar Supabase de novo). Idempotente — 204 mesmo se o token já tiver expirado.

**Rationale**: revogar server-side fecha o caso de "token roubado continua a refrescar". Limpar client garante que `getSession()` devolve null imediatamente.

**Alternativa**: só limpar client. Rejeitado — refresh token continuaria válido até expirar.

---

## R8 — Onde registar a acção "Sair"

**Decisão**: novo componente `client/src/features/shell/UserMenu.tsx` montado no layout `app.tsx`. Dropdown com email do user + role + "Sair". Visível em qualquer rota sob `/app/*` (FR-014).

**Rationale**: layout pai é o local natural; evita duplicação por ecrã.

---

## R9 — Refactor de rotas existentes

**Decisão**: mover ficheiros existentes para `routes/app/`, ajustar imports.

| Antigo | Novo |
|---|---|
| `routes/index.tsx` (redirect) | `routes/index.tsx` (homepage **pública**) + lógica de redirect-quando-autenticado em `beforeLoad` |
| `routes/connect.tsx` | `routes/app/connect.tsx` |
| `routes/inbox/*` | `routes/app/inbox/*` |
| `routes/pipeline/*` | `routes/app/pipeline/*` |
| `routes/settings/*` | `routes/app/settings/*` |

`routeTree.gen.ts` regenera-se automaticamente (vite plugin). Imports relativos dentro de cada subpasta mantêm-se; imports absolutos (alias `@features`, `@hooks`) não mudam.

**Rationale**: mínimo refactor para satisfazer FR-002. Não há lógica de routing a inverter — só caminhos.

**Risco**: testes existentes em `routes/__tests__/guard.test.tsx` e `hooks/__tests__/` podem referir-se a paths velhos. Plano: rodar suite, ajustar paths nos testes, manter cobertura.

---

## R10 — `apiFetch` e 401: comportamento actual

**Estado actual**: ao receber 401, `apiFetch` chama `supabase.auth.signOut()`. Isto contraria a regra "client não chama Supabase Auth directamente" — mas é uma limpeza de **token expirado**, não um logout. Mantém-se aceitável porque é client-only (não tem efeito-colateral server-side); a justificação foi documentada.

**Decisão**: ajustar `apiFetch` para chamar uma função local `clearSession()` (em `lib/api.ts` ou hook `useAuth`) que faz `supabase.auth.signOut({ scope: 'local' })`. Equivalente em comportamento, mas alinha terminologia: "session cleared locally" vs "logged out". Sem chamada de rede ao Supabase.

**Rationale**: cosmético — explicita a intenção. Permite ao test runner assertir que 401 não dispara HTTP a Supabase.
