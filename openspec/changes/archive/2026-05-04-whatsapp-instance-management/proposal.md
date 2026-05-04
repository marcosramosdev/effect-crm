## Why

O CRM precisa ser alimentado por conversas do WhatsApp. Hoje o backend já tem um cliente UAZAPI parcial (criar/conectar/desconectar) e uma `ConnectScreen` minimalista, mas falta um fluxo completo e polido de gestão da instância: o owner não consegue nomear a instância, deletar, reconectar de forma explícita nem ver status da conexão de forma confiável (`getInstanceStatus` não é consumido). A experiência de QR também é frágil — sem expiração visível, sem polling, sem feedback claro.

## What Changes

- Cada tenant pode ter no máximo **uma** instância UAZAPI; nome inicial = nome da empresa (default editável).
- Owner pode **criar** a instância, escolhendo um nome customizado (default = `tenant.name`).
- Owner pode **deletar** a instância (chama `DELETE /instance` UAZAPI + limpa `whatsapp_sessions`).
- Owner pode **conectar / reconectar** (gera novo QR; reusa `instance_token` existente quando a instância já existe).
- Owner pode **verificar status** (read endpoint que faz fallback para `GET /instance/status` UAZAPI quando a sessão local está stale ou em `connecting`).
- UI `ConnectScreen` reformulada com stepper (Criar instância → Conectar → Conectado), nome editável, botões claros para conectar/reconectar/deletar, polling de status enquanto QR está pendente, tratamento de QR expirado.
- Suporte a `UAZAPI_BASE_URL` e `UAZAPI_ADMIN_TOKEN` por ambiente (test = `https://free.uazapi.com` + token de teste; prod = credenciais reais via env).
- **BREAKING (interno)**: `POST /api/whatsapp/connection` deixa de também criar a instância — separar em `POST /api/whatsapp/instance` (create) e `POST /api/whatsapp/instance/connect` (gerar QR / reconectar).

## Capabilities

### New Capabilities
- `whatsapp-connection`: gestão da instância UAZAPI por tenant (CRUD da instância única + ciclo de conexão + UI de onboarding/manutenção).

### Modified Capabilities
_None — `whatsapp-connection` é nova; os specs existentes (dashboard-shell, contacts-page, pipeline-board, user-profile-settings) não mudam comportamento._

## Impact

- **Server**: novas rotas em `server/routes/whatsapp.ts` (`POST /instance`, `DELETE /instance`, `POST /instance/connect`, `GET /instance/status`). Ampliar `server/lib/whatsapp/uazapi-client.ts` com `deleteInstance` e `getInstanceStatus`. A rota legada `POST /whatsapp/connection` é removida (frontend único — sem necessidade de shim).
- **DB**: tabela `whatsapp_sessions` ganha colunas `instance_name text` e `qr_expires_at timestamptz`. Migration nova em `server/db/migrations/006__whatsapp_instance_meta.sql` (e equivalente em `supabase/migrations/`).
- **Client**: `ConnectScreen` reescrita; novos hooks/queries em `client/src/features/whatsapp/`; rota `/app/connect` mantém-se.
- **Env**: documentar `UAZAPI_BASE_URL`, `UAZAPI_ADMIN_TOKEN`, `PUBLIC_WEBHOOK_BASE_URL` em `.env.example`.
- **Testes**: ampliar `server/routes/whatsapp.test.ts`, `server/lib/whatsapp/uazapi-client.test.ts`, `client/src/features/whatsapp/__tests__/ConnectScreen.test.tsx`.
- **Risco externo**: UAZAPI free server tem TTL (~1h) — UI deve avisar quando ambiente é o gratuito.
