# client/CLAUDE.md

Este ficheiro dá contexto específico do frontend (SPA React) em `client/`.

## Papel do frontend

- Autenticação e sessão via Supabase
- Inbox WhatsApp + dashboard de atendimento (UI)
- Gestão de leads e pipelines (CRUD + mover entre etapas)
- Envio de mensagens: chamar o server (`/api/*`) — nunca falar com WhatsApp directamente no browser

## Stack

- React 19 + TypeScript (strict)
- TanStack Router (file-based) + React Query (server state)
- Tailwind 4 + DaisyUI (usar componentes/utilitários existentes)
- Formulários: React Hook Form + Zod

## Comandos

```sh
cd client
bun install
bun --bun run dev      # http://localhost:5173
```

## Routing (TanStack Router)

- Rotas são ficheiros em `src/routes/`.
- Layout base: `src/routes/__root.tsx`.
- ⚠️ Não editar `src/routeTree.gen.ts` (gerado automaticamente).

## Dados e API

- Dados do CRM (leads, pipelines, mensagens) podem vir do Supabase (RLS) e/ou do server.
- Tudo o que envolve credenciais/segredos (ex.: WhatsApp) deve ficar no server.
- Preferir endpoints do server em `/api/*` para facilitar proxy em dev.
- Usar React Query para queries/mutations e invalidations (evitar `useEffect` + fetch manual como padrão).

## Variáveis de ambiente

- No Vite, variáveis do client devem começar por `VITE_` (ex.: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- Nunca usar chaves “service role” no client.

## UI / estilo

- Usar Tailwind + DaisyUI (ex.: `btn`, `input`, `card`).
- Componentes reutilizáveis em `src/components/`.
- Lógica de domínio em `src/features/` e hooks em `src/hooks/`.
