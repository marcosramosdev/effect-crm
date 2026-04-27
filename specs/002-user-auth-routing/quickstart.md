# Quickstart — Spec 002 (Auth & Routing)

Passos para validar a feature ponta-a-ponta em desenvolvimento, depois da implementação concluída.

---

## Pré-requisitos

- Branch `002-user-auth-routing` activa.
- Supabase local ou cloud com:
  - tabelas `tenants`, `tenant_members` criadas (via migrações da feature 001).
  - RLS activo (`002__rls.sql`).
  - `auth_rate_limit` por defeito (não desactivar).
- Variáveis de ambiente:
  - **server**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`.
  - **client**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

---

## Setup

```sh
# server
bun install
bun run dev          # http://localhost:3000

# client (outra shell)
cd client
bun install
bun --bun run dev    # http://localhost:5173
```

Vite proxy de `/api` → `:3000` já configurado em `client/vite.config.ts` (feature 001).

---

## Cenário 1 — Visitante anónimo vê homepage (US1)

1. Abrir `http://localhost:5173/` em janela anónima.
2. **Esperado**: HomePage com nome do produto + dois botões ("Entrar", "Criar conta"). Sem flash. Network tab não mostra chamada autenticada.
3. Click em "Entrar" → URL muda para `/auth/login`.
4. Click em "Criar conta" (a partir do login) → URL muda para `/auth/register`.

---

## Cenário 2 — Auto-registo cria tenant (US2)

1. Em `/auth/register`, preencher:
   - Email: `owner+test1@empresa.pt`
   - Senha: `senha-de-teste-1`
   - Nome da empresa: `Empresa Teste 1`
2. Submeter.
3. **Esperado**:
   - `POST /api/auth/register` → `201` com `AuthSession`.
   - Redirect imediato para `/app/inbox` (ou `/app/connect` se WhatsApp ainda não ligado).
   - `localStorage` contém `sb-…-auth-token`.
   - Inspecionar Supabase: nova row em `tenants` com `name='Empresa Teste 1'` e nova row em `tenant_members` com `role='owner'`.
4. Recarregar a página → continua autenticado, sem voltar a login.

### Caminho infeliz: email duplicado

1. Repetir registo com mesmo email.
2. **Esperado**: `409` com `code: 'EMAIL_EXISTS_OR_INVALID'`. Mensagem PT no campo email. Sem nova row em `tenants`.

### Caminho infeliz: tenant_name curto

1. Submeter com `tenantName='X'`.
2. **Esperado**: erro 400 client-side (Zod) **antes** de chamar API. Form sinaliza campo.

---

## Cenário 3 — Login com return-to (US3)

1. Logout (cf. cenário 4) ou abrir nova janela anónima.
2. Abrir directamente `http://localhost:5173/app/pipeline`.
3. **Esperado**: redirect para `/auth/login?redirect=%2Fapp%2Fpipeline`. Sem flash de pipeline.
4. Submeter credenciais válidas.
5. **Esperado**: chega a `/app/pipeline` (não `/app/inbox` por defeito).

### Caminho infeliz: senha errada

1. Submeter com password errada.
2. **Esperado**: `401` com `code: 'INVALID_CREDENTIALS'`. Form mostra "Email ou senha inválidos.". Email **não** é distinguido de senha.

### Caminho infeliz: email inexistente

1. Submeter `unknown@test.pt` + qualquer senha.
2. **Esperado**: mesma resposta — `401 INVALID_CREDENTIALS` com mensagem genérica.

---

## Cenário 4 — Logout (US4)

1. Em `/app/inbox`, abrir `<UserMenu>` (canto superior direito).
2. Click "Sair".
3. **Esperado**:
   - `POST /api/auth/logout` → `204`.
   - `localStorage` limpa do token Supabase.
   - Redirect para `/`.
   - Tentar voltar atrás (browser back) → URL anterior aparece em cache mas qualquer interacção dispara redirect para `/auth/login`.

### Idempotência

1. Após logout, reenviar `POST /api/auth/logout` (cURL com Bearer já inválido).
2. **Esperado**: `401 INVALID_CREDENTIALS` (header inválido).
3. (Server-side) testar com token válido mas já revogado → `204`.

---

## Cenário 5 — Gating completo (US5)

Matriz de validação manual ou em teste E2E:

| URL | Sessão | Esperado |
|---|---|---|
| `/` | sim | redirect `/app` |
| `/` | não | renderiza HomePage |
| `/auth/login` | sim | redirect `/app` |
| `/auth/login` | não | renderiza form |
| `/auth/register` | sim | redirect `/app` |
| `/auth/register` | não | renderiza form |
| `/app/inbox` | sim | renderiza inbox |
| `/app/inbox` | não | redirect `/auth/login?redirect=/app/inbox` |
| `/app/foo-inexistente` | qualquer | "não encontrado" |
| `/qualquer-coisa` | qualquer | "não encontrado" |

---

## Validar TDD

```sh
# server
bun --bun run test                            # passa toda a suite (incluindo nova auth)
bun --bun run test server/lib/auth/register   # só os novos
bun --bun run test server/routes/auth         # handlers HTTP

# client
cd client
bun run test                                  # passa toda a suite
```

**Sem TDD, sem merge** — Princípio III + user prompt 002.

---

## Limpeza após teste

```sql
-- Supabase SQL editor
delete from tenant_members where user_id in (select id from auth.users where email like 'owner+test%');
delete from tenants where name like 'Empresa Teste%';
-- + apagar users de teste no Auth dashboard ou via admin API
```
