# Quickstart — WhatsApp CRM Core

Como arrancar o desenvolvimento da feature `001-whatsapp-crm-core` depois do plano estar aprovado. Não é um guia de utilizador — é o guia do programador.

## Pré-requisitos

- Bun instalado (server runtime + package manager).
- Conta/projecto Supabase (free tier chega para dev). Precisa de:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (só no server)
  - `SUPABASE_JWT_SECRET` (para validar JWTs no server sem chamar o endpoint `verify`)
- Conta uazapiGO (docs `https://docs.uazapi.com/`, spec OpenAPI em `uazapi-openapi-spec.yaml` na raiz do repo). Precisa de:
  - `UAZAPI_BASE_URL` — em dev normalmente `https://free.uazapi.com`; em staging/produção o subdomain que o plano contratado fornecer.
  - `UAZAPI_ADMIN_TOKEN` — `admintoken` para provisionar instâncias (`/instance/create`). **Sensível — só no server.**
- Um WhatsApp real num telemóvel para emparelhar (recomendado: um número de teste — preferencialmente WhatsApp Business, a própria uazapi desaconselha o WhatsApp "normal" por risco de bloqueio).
- Em dev local, um túnel HTTP público para que a uazapi possa chamar o nosso webhook. Opções:
  - `cloudflared tunnel --url http://localhost:3000` (recomendado — grátis e estável).
  - `ngrok http 3000`.
  - Exportar o URL resultante como `PUBLIC_WEBHOOK_BASE_URL` antes de arrancar o server.

## Variáveis de ambiente

**Server** — `server/.env` (não commitar):

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
UAZAPI_BASE_URL=https://free.uazapi.com
UAZAPI_ADMIN_TOKEN=...
PUBLIC_WEBHOOK_BASE_URL=https://your-cloudflared-tunnel.example.com
WHATSAPP_LOG_LEVEL=info
PORT=3000
```

**Client** — `client/.env.local` (não commitar):

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_API_BASE_URL=http://localhost:3000
```

## Setup inicial (uma vez)

1. **Criar o schema no Supabase**: correr os SQLs em `server/db/migrations/` pela ordem numérica, via Supabase SQL editor ou CLI. Inclui tabelas + RLS + triggers + seed das etapas por omissão.
2. **Criar o primeiro tenant e owner manualmente** (enquanto não há endpoint de sign-up):
   - Inserir uma row em `tenants`.
   - Criar um user no Supabase Auth (`Authentication → Users → Invite user`).
   - Inserir em `tenant_members` com `role='owner'`.
3. **Instalar deps**:
   - `bun install` (root, para o server)
   - `cd client && bun install`
4. **Adicionar aliases partilhados**:
   - Em `client/tsconfig.json` → `paths`: adicionar `"@shared/*": ["../server/types/*"]` e estender `include` para incluir `"../server/types/**/*.ts"`.
   - Em `client/vite.config.ts` → `resolve.alias`: adicionar `"@shared": path.resolve(__dirname, "../server/types")`.

## Correr localmente

Dois processos (ou `bun run dev` na root, que já corre ambos via `concurrently`):

```sh
# Server (root)
bun run server         # :3000, hot reload

# Client (client/)
cd client && bun --bun run dev   # :5173
```

Vite dev proxy deve forwardar `/api/*` para `http://localhost:3000` (adicionar em `client/vite.config.ts` `server.proxy`).

## Fluxo de verificação manual (smoke test)

**Pré-requisito**: túnel público (`cloudflared`/`ngrok`) a apontar para `http://localhost:3000` e `PUBLIC_WEBHOOK_BASE_URL` no `.env` a apontar para esse túnel.

1. Abrir `http://localhost:5173/login` → autenticar com o owner criado.
2. Ir a `/connect` → clicar "conectar". Na primeira vez o server chama `POST {UAZAPI_BASE_URL}/instance/create` e persiste `uazapi_instance_id` + `uazapi_instance_token` + `uazapi_webhook_secret` em `whatsapp_sessions`. Depois configura o webhook na uazapi e pede QR. Verificar no Supabase que a row foi criada e que o `uazapi_webhook_secret` é um UUID novo.
3. Emparelhar com QR do telemóvel. Após ~2s a uazapi envia evento `connection` (`state: 'connected'`) para `/api/webhooks/uazapi/<secret>`; `whatsapp_sessions.status` muda para `connected` e o client recebe via Realtime. Estado visível: "conectado" + `phone_number` preenchido.
4. Enviar uma mensagem de um número externo para o número emparelhado. Confirmar:
   - Log do server mostra `POST /api/webhooks/uazapi/<secret>` com evento `messages`.
   - `leads`, `conversations`, `messages` têm as novas rows (inbound).
   - Inbox no `/inbox` actualiza em <5s via Realtime.
5. Responder pelo CRM. Confirmar:
   - `POST /api/inbox/conversations/:id/messages` → 202 com `status: 'pending'`.
   - Server chamou `POST {UAZAPI_BASE_URL}/send/text` com header `token` correcto.
   - Mensagem chegou ao telemóvel externo.
   - Webhook `messages_update` faz a mensagem transitar `pending → sent → delivered` no histórico do inbox.
6. Ir a `/pipeline` → mover o lead de `Novo` para `Em conversa` → refrescar → persistiu.
7. Ir a `/settings/pipeline` (owner) → renomear uma etapa e reordenar → confirmar que `/pipeline` reflecte.
8. Tentar aceder a `/settings/pipeline` como `agent` → 403 esperado.
9. Cenário negativo — desconexão: clicar "desconectar" no `/connect`. Server chama `POST {UAZAPI_BASE_URL}/instance/disconnect`. Tentar enviar mensagem no `/inbox` → 409 `WHATSAPP_DISCONNECTED` esperado.
10. Cenário negativo — rate limit: disparar >20 envios em 60s → 429 com `Retry-After` visível na UI.

## Workflow TDD

Esta feature segue TDD pragmático (ver `plan.md` → "Development Approach (TDD)" e `research.md` → R-012). Para cada unidade de trabalho do `tasks.md`:

1. **Red** — escrever o teste listado em `contracts/test-strategy.md` (ou o próximo teste útil se não estiver listado). Correr:

   ```sh
   # server
   bun test path/to/my-new.test.ts

   # client
   cd client && bun --bun run test -- path/to/my-new.test.tsx
   ```

   Verificar que o teste **falha pela razão certa** (o comportamento ainda não existe). Se falhar por typo, arranjar antes de prosseguir.

2. **Green** — escrever só o código necessário para o teste passar. Sem funcionalidade extra.

3. **Refactor** — com o verde na mão, melhorar nomes, eliminar duplicação. Correr testes após cada alteração.

4. **Commit** — um commit por unidade (ou agrupando Red+Green+Refactor). Mensagem descreve comportamento, não mecanismo.

Se estás a começar uma task, procura o ID do teste correspondente em `contracts/test-strategy.md` (ex.: `T-S-052`). As tasks em `tasks.md` (geradas por `/speckit-tasks`) referenciam directamente esses IDs.

### Mocks e fixtures (onde estão)

- Server: `server/test/fixtures/{jwts,supabase}.ts`, `server/lib/whatsapp/__fixtures__/uazapi-events.ts`.
- Client: `client/src/test/setup.ts`, `client/src/test/msw/handlers.ts`.

Criar estes ficheiros é a primeira tarefa de infra a fazer (listada no `tasks.md`). Depois disso, todos os outros testes os consomem.

### Pre-commit (recomendado, não obrigatório)

Se quiseres impedir que código sem testes chegue a um commit local, instala um hook simples em `.husky/pre-commit`:

```sh
#!/bin/sh
set -e
# Lint + type-check do client
(cd client && bun --bun run lint)
(cd client && bun --bun tsc --noEmit)
# Type-check do server
bun --bun tsc --noEmit -p tsconfig.json
# Testes de ambos
bun test
(cd client && bun --bun run test)
```

Alternativa: confiar exclusivamente no gate de CI. A MVP não impõe Husky.

## Testes automatizados

**Server** (Vitest):

- `server/lib/whatsapp/rate-limiter.test.ts` — token bucket dá tokens e refresca no intervalo certo.
- `server/lib/whatsapp/uazapi-client.test.ts` — cada método (create, connect, disconnect, sendText) monta o request certo (URL, headers `admintoken` vs `token`, body) contra um `fetch` mockado; parseia respostas de sucesso e propaga 401/429 como erros tipados.
- `server/lib/whatsapp/webhook-handler.test.ts` — mapeamento `messages` → insert de `lead` + `conversation` + `message` (com on-conflict idempotente); `messages_update` → update de status; `connection` → update de `whatsapp_sessions.status`; rejeita payloads sem `instance` correcto.
- `server/routes/webhooks.test.ts` — segredo inválido → 401; segredo válido mas `instance` de outro tenant → 400; fluxo completo com payload válido → 200 e row inserida.
- `server/routes/inbox.test.ts` — `POST /conversations/:id/messages` devolve 409 quando a sessão está desconectada; devolve 429 quando rate-limited (bucket local OU uazapi retornou 429).
- `server/routes/pipeline.test.ts` — `DELETE /stages/:id` devolve 409 sem `destinationStageId` quando há leads, 204 quando movidos.
- `server/middlewares/auth.test.ts` — rejeita JWT inválido, resolve `tenantId` correcto para JWT válido.

**Client** (Vitest + Testing Library):

- `features/pipeline/__tests__/move-lead.test.tsx` — drag-and-drop dispara a mutation e actualiza a cache React Query.
- `features/inbox/__tests__/send-message.test.tsx` — submissão do formulário com React Hook Form + Zod resolver; bloqueia quando `disabled=true` (sessão desconectada).
- `features/auth/__tests__/guard.test.tsx` — uma rota `/settings/pipeline` redirecciona se `role=agent`.

Correr tudo:

```sh
# Server — Bun test (nativo)
bun test

# Server — um ficheiro específico
bun test server/routes/inbox.test.ts

# Client — Vitest
cd client && bun --bun run test

# Client — watch mode durante TDD
cd client && bun --bun run test -- --watch

# Client — só um ficheiro
cd client && bun --bun run test -- features/inbox/__tests__/send-message.test.tsx

# Client — por nome (grep nas descrições `it()`)
cd client && bun --bun run test -- -t "disconnected"
```

Inventário completo dos testes: [`contracts/test-strategy.md`](./contracts/test-strategy.md).

## Dockerfile (produção) — esqueleto a criar

Este deliverable é responsabilidade de `/speckit-tasks`; documentado aqui para referência:

```Dockerfile
# stage 1: build client
FROM oven/bun:1-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/bun.lock ./
RUN bun install --frozen-lockfile
COPY client/ ./
COPY server/types/ /app/server/types/
RUN bun --bun run build

# stage 2: server runtime
FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "server/index.ts"]
```

## Checklist de prontidão antes de `/speckit-tasks`

- [ ] Confirmar com o utilizador as três decisões "open items carried over" do plan (roles, rate limit, deleção de leads).
- [ ] Supabase projecto criado, credenciais disponíveis.
- [ ] Conta uazapi disponível (`UAZAPI_BASE_URL`, `UAZAPI_ADMIN_TOKEN`).
- [ ] Túnel público configurado em dev (`PUBLIC_WEBHOOK_BASE_URL`).
- [ ] Variáveis de ambiente configuradas (server + client).
- [ ] Migrações SQL aplicadas num projecto Supabase de dev.
- [ ] Primeiro tenant + owner criados manualmente para permitir login.
