# server/CLAUDE.md

Contexto específico do backend (Hono + Bun) em `server/`.

## Responsabilidades do server

- API HTTP para o frontend (padronizar em `/api/*`)
- Integração WhatsApp (ligação, recepção de mensagens, envio de mensagens)
- Em produção, servir o SPA do frontend (`client/dist`) e fazer fallback para `index.html`

## Execução

- Entrada: `server/index.ts`
- Dev (hot reload): `bun run dev`
- Porta: `PORT` (definir no Docker/ambiente)

Nota: o `tsconfig.json` do root define `jsxImportSource: "hono/jsx"`. Se houver JSX no server, é JSX do Hono (não React).

## Organização sugerida

- `server/routes/`: rotas agrupadas por domínio (ex.: leads, pipelines, whatsapp)
- `server/middlewares/`: auth, logging, error handler
- `server/validator/`: validação de input (preferir Zod)
- `server/db/`: cliente Supabase e helpers
- `server/lib/`: integrações externas (ex.: WhatsApp provider)

## Supabase (auth + dados)

- **Nunca** expor `SUPABASE_SERVICE_ROLE_KEY` fora do server.
- Para requests do utilizador, preferir criar um cliente Supabase com o JWT do request para respeitar RLS.
- Para ingest de mensagens WhatsApp/tarefas internas, usar service role, mas guardar sempre `org_id` e garantir isolamento.

## Autenticação

- Cliente envia `Authorization: Bearer <supabase_access_token>`.
- Server valida e usa `sub` (user id) + org/tenant (claim ou lookup) para autorizar.
- Evitar criar um sistema de auth paralelo ao Supabase.
- Endpoints de auth disponíveis: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`.
  - `register`: cria utilizador no Supabase Auth + registo na tabela `tenants`/`profiles`.
  - `login`: autentica via Supabase e devolve `access_token` + `refresh_token`.
  - `logout`: invalida a sessão do utilizador no Supabase.

## WhatsApp (provider/adaptor)

- Encapsular a lib num módulo (ex.: `server/lib/whatsapp/*`) e expor uma interface interna.
- Guardar sessão/credenciais encriptadas no Supabase (nunca em ficheiros locais / no repo).
- Implementar reconexão e controlo de rate (envio de mensagens).
- Não logar segredos (tokens, cookies, chaves).

## Static serving (produção)

- Servir `client/dist` como assets. Usando bun serverStatic, apontar para `client/dist`.
- Qualquer rota não-`/api/*` deve retornar `index.html` (SPA fallback).

## Pipeline / Leads

- Leads criados manualmente sem telefone usam placeholder `manual:<uuid>` para satisfazer a unique constraint `unique(tenant_id, phone_number)`.
- Queries do inbox WhatsApp devem excluir leads com `phone_number like 'manual:%'` para não poluir a lista de conversas.

## Boas práticas

- Validar payloads (Zod) e devolver erros consistentes.
- Logs estruturados e sem informação sensível.
