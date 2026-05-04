## Context

O backend já tem um cliente UAZAPI parcial (`server/lib/whatsapp/uazapi-client.ts`) e uma rota única `POST /api/whatsapp/connection` que mistura criação + conexão. O frontend (`ConnectScreen.tsx`) reflete essa mistura: o owner clica "Conectar" e a instância é criada implicitamente. Não há nome customizável, não há delete, não há polling de status, não há gestão de QR expirado.

`whatsapp_sessions` (em `server/db/migrations/001__init.sql`) já guarda `uazapi_instance_id`, `uazapi_instance_token`, `uazapi_webhook_secret`, `phone_number`, `status`, `last_heartbeat_at`, `last_error`. Falta `instance_name` e `qr_expires_at`.

UAZAPI tem dois endpoints relevantes não usados ainda:
- `DELETE /instance` (header `token`) → remove instância
- `GET /instance/status` (header `token`) → estado canônico + QR atualizado

Ambiente de teste: `https://free.uazapi.com` + admin token `ZaW1qwTEkuq7Ub1cBUuyMiK5bNSu3nnMQ9lh7klElc2clSRV8t` (TTL ~1h, limites). Produção: credenciais próprias do user.

## Goals / Non-Goals

**Goals:**
- API REST clara: 1 recurso `instance` com verbos `POST` (create), `DELETE` (remove), `POST /connect` (gera QR), `GET /status` (poll).
- UX guiado: stepper visual, default = nome da empresa, contador regressivo do QR, botão de delete com confirmação.
- Defaults de dev seguros (apontar para UAZAPI free) sem comprometer produção (boot falha se admin token faltar).
- Reuso máximo do que existe: `uazapi-client.ts`, `whatsapp_sessions`, canal Realtime já usado em `ConnectScreen`.

**Non-Goals:**
- Múltiplas instâncias por tenant. Decisão explícita: 1 tenant = 1 instância.
- Pareamento por código (campo `phone`). Apenas QR nesta versão — código vem depois se for pedido.
- Recepção/envio de mensagens — já existe parcialmente (`sendText`, `webhook-handler`); este change toca apenas no ciclo de vida da instância.
- UI de seleção de eventos do webhook — fixos em `["messages","messages_update","connection"]`.

## Decisions

### D1. Separar `create` e `connect` em rotas distintas

**Decisão:** `POST /api/whatsapp/instance` cria, `POST /api/whatsapp/instance/connect` gera QR. Hoje estão fundidos em `POST /whatsapp/connection`.

**Por quê:** o owner precisa nomear a instância **antes** de conectar (a UAZAPI usa esse nome no `/instance/create`). Manter os dois passos juntos força UI awkward (input de nome + QR aparecendo no mesmo botão). Separar também permite "reconectar" como verbo claro (chamar só `/connect`).

**Alternativa considerada:** manter um único `POST /connection` aceitando opcionalmente `name`. Rejeitada — fica ambíguo se o nome é usado quando a instância já existe (ignorado? rename?).

### D2. Nome default = `tenant.name`, editável no frontend

**Decisão:** o frontend lê `tenant.name` do `useAuth()` e pré-preenche; o servidor valida 1–64 chars. O servidor **não** aplica o default — exige `name` no body.

**Por quê:** explícito > implícito. Backend não precisa carregar `tenants` só para resolver default; o frontend já tem o dado. Reduz acoplamento.

### D3. Polling client-side (3s) + Realtime do Supabase

**Decisão:** manter o canal `postgres_changes` em `whatsapp_sessions_public` (já existe) para push-notify quando o webhook UAZAPI atualizar `status="connected"`, **e** adicionar polling de 3s enquanto `status ∈ {qr_pending, connecting}` como fallback.

**Por quê:** o webhook da UAZAPI pode atrasar/falhar; polling garante feedback rápido. Realtime evita poll quando já conectado. Os dois juntos cobrem ambas as falhas.

**Alternativa considerada:** SSE no servidor proxy do UAZAPI `/sse`. Rejeitada — overhead pra primeira versão; polling de 3s por 2 min é trivial.

### D4. `qr_expires_at` em coluna nova vs derivar do `last_updated`

**Decisão:** coluna nova `qr_expires_at timestamptz` em `whatsapp_sessions`. Server seta `now() + interval '120 seconds'` ao gerar QR e limpa quando `status` vira `connected` ou `disconnected`.

**Por quê:** UAZAPI documenta timeout de 2min para QR. Derivar de `updated_at` é frágil (qualquer update reseta). Coluna explícita é clara e barata.

### D5. Webhook secret reusado entre conexões

**Decisão:** `uazapi_webhook_secret` é gerado uma vez no create e reusado em todos `connect`/`reconnect`. Apenas regenerar no delete.

**Por quê:** se o secret muda a cada connect, o webhook URL muda e há janela onde a UAZAPI ainda manda pro URL antigo. Estabilidade > rotação agressiva.

### D6. Tratar UAZAPI 429 como `503 UAZAPI_OVERLOADED`

**Decisão:** mapear UAZAPI `429` (limite de instâncias do servidor) para HTTP `503` da nossa API com mensagem pt-BR.

**Por quê:** `429` no nosso domínio significaria "rate limit do CRM"; `503` (servidor upstream indisponível) descreve melhor para o owner. Mensagem orienta: "servidor UAZAPI está cheio, tente em instantes ou troque de plano".

### D7. Boot fail-fast em produção sem token

**Decisão:** ao iniciar o server, se `NODE_ENV=production` e `UAZAPI_ADMIN_TOKEN` vazio → throw + exit. Em dev, warn + usa default.

**Por quê:** evita o cenário "produção começou a falhar silenciosamente em todas as criações de instância". Falhar no boot é diagnosticável; falhar na primeira criação é caçar bug obscuro.

### D8. Delete idempotente

**Decisão:** UAZAPI 404 no delete = sucesso local. Sempre limpar a linha local, mesmo se a UAZAPI já removeu.

**Por quê:** drift entre UAZAPI e nosso DB pode acontecer (TTL do free server). O owner querer "limpar" deve sempre funcionar.

## Risks / Trade-offs

- **[Risco] UAZAPI free TTL de 1h apaga instância sem aviso** → Mitigação: o `GET /instance/status` retorna `404` quando isso acontece; o handler local detecta e zera a linha de `whatsapp_sessions`. UI mostra "Instância expirou (servidor free), crie novamente". Documentar no `.env.example`.
- **[Risco] `UAZAPI_ADMIN_TOKEN` de teste vaza no log** → Mitigação: o cliente nunca loga headers; revisar `webhook-handler.ts` e adicionar teste que garante ausência do token em logs.
- **[Risco] Polling de 3s com 100+ owners simultaneamente** → Trade-off aceito: poll só roda enquanto QR está aberto (≤2 min) e só para owner em `/app/connect`. Volume esperado é baixo. Migrar para SSE/WebSocket é futuro.
- **[Risco] Webhook URL hard-coded em `PUBLIC_WEBHOOK_BASE_URL`** → já existente. Documentar que precisa ser HTTPS público (ngrok em dev, domínio em prod).
- **[Trade-off] Não há rename da instância** → simplicidade. Para mudar nome: delete + recreate. Documentar.
- **[Risco] Race entre polling e Realtime atualizando `setQueryData`** → React Query lida bem com last-write-wins; idempotente porque ambos derivam da mesma row. Ok.

## Migration Plan

1. Criar migration `006__whatsapp_instance_meta.sql` em `server/db/migrations/` (e `supabase/migrations/`):
   ```sql
   alter table whatsapp_sessions
     add column instance_name text,
     add column qr_expires_at timestamptz;
   ```
2. Backfill: `update whatsapp_sessions set instance_name = (select name from tenants where id = tenant_id) where instance_name is null;` (best-effort).
3. Atualizar view `whatsapp_sessions_public` (em `005__views.sql`) para expor `instance_name` e `qr_expires_at` (sem expor tokens).
4. Deploy do servidor com novas rotas; rota legada `POST /whatsapp/connection` removida no mesmo deploy (frontend muda no mesmo PR — não há cliente externo).
5. Deploy do frontend novo.

**Rollback:** reverter o deploy do server + frontend juntos. A migration é aditiva — colunas novas podem ficar.

## Open Questions

- Q1: O webhook UAZAPI envia evento `connection` quando o status muda para `connected`? Confirmar pelos fixtures em `__fixtures__/uazapi-events.ts` ou adicionar fixture novo. _(Esperado: sim, conforme yaml — validar no test.)_
- Q2: Devemos guardar `instance_name` separado ou consultar UAZAPI a cada status? → Decisão atual: guardar local (rápido, ~zero custo). Reavaliar se houver rename pelo lado UAZAPI.
- Q3: Mostrar o ambiente UAZAPI ativo (free vs pago) na UI? → Sugestão: badge "Servidor de teste — instância expira em 1h" quando `UAZAPI_BASE_URL` contém `free.uazapi.com`. Marcar como nice-to-have nas tasks.
