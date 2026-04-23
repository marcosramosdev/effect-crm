# CLAUDE.md

Este ficheiro orienta o Claude Code (claude.ai/code) quando trabalhar neste repositório.

## Contexto do produto (o que estamos a construir)

CRM multi-tenant para uma empresa de marketing digital oferecer aos seus clientes.

Funcionalidades core (manter o foco; não inventar outras):

- Inbox WhatsApp: listar conversas/leads que entram via WhatsApp e o estado do atendimento
- Resposta pelo app: enviar mensagens WhatsApp a partir do CRM
- Pipeline(s) personalizáveis: cada cliente define colunas/etapas e evolui leads entre etapas
- Ligação WhatsApp no app: fluxo de conexão (ex.: QR code) e gestão de sessão

## Stack e decisões

- Backend: Bun + Hono (TypeScript). Em produção, o backend serve a API **e** o frontend (SPA React).
- Frontend: React 19 + TanStack Router (file-based) + React Query, Vite 8, Tailwind 4 + DaisyUI.
- Auth/DB: Supabase (Auth + Postgres + RLS). Supabase é a fonte de verdade para auth e dados.
- Deploy: Docker numa VPS (um container final a correr o server).

## Estrutura do repositório

Este repo tem 2 workspaces independentes (não há pnpm workspaces/turbo):

- `server/` (root `package.json`): Hono/Bun
- `client/` (`client/package.json`): React/Vite

⚠️ `bun install` no root instala só deps do server. Para o frontend: `cd client && bun install`.

## Comandos (desenvolvimento)

Executar comandos do server no root; comandos do frontend dentro de `client/`.

**Server (root):**

```sh
bun install
bun run dev
```

**Client (`cd client`):**

```sh
bun install
bun --bun run dev      # Vite em http://localhost:5173
bun --bun run build
bun --bun run test
bun --bun run lint
bun --bun run format
bun --bun run check
```

## Full-stack: como ligar client ↔ server

- Em desenvolvimento, o client corre em Vite (5173) e o server corre separado (porta via `PORT`, normalmente 3000).
- As rotas do server devem viver sob `/api/*`.
- Quando o client começar a chamar a API, configurar proxy em `client/vite.config.ts` para encaminhar `/api` para o server.

## Produção (server a servir o SPA)

Objetivo: um único processo/porta em runtime.

- `bun --bun run build` em `client/` gera `client/dist`.
- O server deve servir `client/dist` como estáticos e fazer fallback para `index.html` (SPA) para rotas não-API.
- Rotas `/api/*` continuam a responder normalmente.

## Supabase (segurança e multi-tenant)

- **Nunca** colocar `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- Frontend: usar apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Backend: pode usar `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` para ingest de mensagens WhatsApp e tarefas internas.
- Isolamento por cliente deve ser garantido por RLS (ex.: coluna `org_id`/`account_id` em todas as tabelas).
- Endpoints do server devem validar JWT do Supabase em `Authorization: Bearer <token>` (evitar sessões próprias no backend).

## WhatsApp (integração não-oficial)

- Atenção: integrações “não-oficiais” podem violar Termos do WhatsApp e quebrar sem aviso. Não assumir estabilidade.
- Encapsular a integração atrás de um “provider/adaptor” (não espalhar chamadas da lib WhatsApp pela app).
- Fluxo mínimo esperado:
  1.  iniciar ligação e disponibilizar QR (ou equivalente) ao frontend
  2.  receber mensagens → persistir no Supabase → actualizar dashboard/inbox
  3.  enviar mensagens a partir do CRM → passar pelo server → persistir resultado

## Notas importantes do client

- O router é file-based: criar ficheiros em `client/src/routes/` cria rotas.
- Não editar manualmente `client/src/routeTree.gen.ts` (gerado automaticamente).

## Convenções

- TypeScript strict; respeitar `noUnusedLocals/Parameters` no client.
- Prettier: sem `;`, aspas simples, trailing commas (ver `client/prettier.config.js`).
- Não introduzir novas dependências sem necessidade; se introduzir, justificar e actualizar o `package.json` correcto (root vs `client/`).

<!-- SPECKIT START -->

For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan

<!-- SPECKIT END -->
