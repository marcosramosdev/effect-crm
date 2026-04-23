# Webhook Contracts — `/api/webhooks/uazapi/:webhookSecret`

Endpoint **inbound** do nosso server, chamado pela uazapiGO quando eventos acontecem no WhatsApp do tenant (mensagem recebida, status de envio actualizado, estado da conexão mudou).

Este endpoint é **público** (sem JWT Supabase) porque quem chama é a uazapi, não um agente. A autenticação faz-se pelo segredo embebido no URL, que resolve o tenant e valida a origem.

---

## `POST /api/webhooks/uazapi/:webhookSecret`

**Auth**: `webhookSecret` no path tem de bater com `whatsapp_sessions.uazapi_webhook_secret` de exactamente um tenant (comparação timing-safe). Caso contrário → `401`, sem revelar se o segredo existia.

**Request headers**: `Content-Type: application/json`. (Não exigimos headers especiais da uazapi — ela não envia um header HMAC uniforme, o segredo no URL é o mecanismo de auth.)

**Body (Zod union por `event`)**: todos os eventos partilham um invólucro comum:

```ts
WebhookEventEnvelopeSchema = z.object({
  event: z.enum(['messages', 'messages_update', 'connection']),
  instance: z.string(), // id uazapi da instância — deve bater com whatsapp_sessions.uazapi_instance_id do tenant resolvido
  data: z.unknown(),
})
```

**Validação geral**:

1. Segredo → `tenant_id` (service-role lookup).
2. `envelope.instance === whatsapp_sessions.uazapi_instance_id` — se não bater, `400 INSTANCE_MISMATCH` (indica que o webhook foi reconfigurado fora de banda).
3. Parse de `envelope.data` segundo o schema específico abaixo por tipo de evento.

**Resposta**: sempre `200 OK` body `{ ok: true }` excepto nas falhas 4xx acima. Erros 5xx só em falha real de persistência (a uazapi vai retentar).

---

## Evento `messages` — mensagem recebida/enviada

Payload (campos relevantes ao MVP; resto ignorado):

```ts
IncomingMessageSchema = z.object({
  id: z.string(),            // whatsapp_message_id
  chatid: z.string(),        // JID do contato (p.ex. "5511999999999@s.whatsapp.net") ou grupo
  fromMe: z.boolean(),       // true se enviada pelo próprio número (ignorar: usamos excludeMessages: ["wasSentByApi"])
  messageType: z.enum([
    'conversation', 'extendedTextMessage',
    'imageMessage', 'videoMessage', 'audioMessage', 'documentMessage',
    'stickerMessage', 'locationMessage', 'contactMessage',
    // outros — tratados como 'unsupported'
  ]).or(z.string()),
  text: z.string().nullable().optional(),    // presente só em conversation / extendedTextMessage
  pushName: z.string().nullable().optional(),
  timestamp: z.number(),     // unix seconds
})
```

**Mapeamento para a DB**:

1. Extrair `phoneNumber` do `chatid` (strip do sufixo `@s.whatsapp.net`). Rejeitar grupos (`@g.us`) com 200+nothing — MVP não cobre grupos.
2. Upsert `lead` via `(tenant_id, phone_number)`:
   - Se inexistente → criar; `stage_id` = etapa com `is_default_entry=true`.
   - Se existente → actualizar `display_name = pushName` (se não-nulo).
3. Upsert `conversation` para `(tenant_id, lead_id)`; se inexistente, criar com `unread_count = 0`.
4. `INSERT INTO messages` (`id` = uuid próprio; `whatsapp_message_id` = `payload.id`) com:
   - `direction = 'inbound'` (se `fromMe=false`; mensagens `fromMe=true` em princípio não chegam cá por causa de `excludeMessages: ["wasSentByApi"]`, mas se chegarem, tratamos como `outbound` sem `sent_by_user_id` — representa mensagens enviadas fora do CRM, e.g., pelo telemóvel do próprio tenant).
   - `content_type = 'text'` quando `messageType ∈ {conversation, extendedTextMessage}` e `text` presente; caso contrário `'unsupported'` e `text = null`.
5. `ON CONFLICT (tenant_id, whatsapp_message_id) DO NOTHING` — idempotência em caso de re-entrega pela uazapi.
6. Triggers a seguir actualizam `conversations.last_message_at` e `unread_count` (só inbound incrementa).

---

## Evento `messages_update` — actualização de status de envio

```ts
MessageUpdateSchema = z.object({
  id: z.string(),             // whatsapp_message_id
  status: z.enum(['PENDING', 'SERVER_ACK', 'DELIVERY_ACK', 'READ', 'FAILED']),
  chatid: z.string().optional(),
})
```

**Mapeamento**:

- `UPDATE messages SET status = $mapped, read_at = CASE WHEN $status='READ' THEN now() ELSE read_at END WHERE tenant_id = $tenant_id AND whatsapp_message_id = $id;`
- Tradução de status:
  - `PENDING` → não actualiza (já está `pending` no insert).
  - `SERVER_ACK` → `sent`.
  - `DELIVERY_ACK` → `delivered`.
  - `READ` → `read`.
  - `FAILED` → `failed`, com `error = 'whatsapp delivery failed'`.
- Se a mensagem não existe (não enviada por nós), ignorar silenciosamente. Isso acontece quando `excludeMessages: ["wasSentByApi"]` não filtrou tudo.

---

## Evento `connection` — estado da conexão

```ts
ConnectionUpdateSchema = z.object({
  state: z.enum(['disconnected', 'connecting', 'connected']),
  phoneNumber: z.string().optional(),
  reason: z.string().optional(),
})
```

**Mapeamento**:

- `UPDATE whatsapp_sessions SET status = $state, phone_number = COALESCE($phoneNumber, phone_number), last_heartbeat_at = CASE WHEN $state='connected' THEN now() ELSE last_heartbeat_at END, last_error = CASE WHEN $state='disconnected' AND $reason IS NOT NULL THEN $reason ELSE last_error END WHERE tenant_id = $tenant_id;`
- O client recebe a mudança via Supabase Realtime na view `whatsapp_sessions_public` (ver `data-model.md`), sem polling.

---

## Idempotência e retry

- A uazapi retenta em caso de 5xx. Desenhamos tudo para ser idempotente:
  - `messages` tem `UNIQUE (tenant_id, whatsapp_message_id)` (onde `whatsapp_message_id IS NOT NULL`). Upsert com `DO NOTHING`.
  - `leads` tem `UNIQUE (tenant_id, phone_number)`. Upsert.
  - `conversations` tem `UNIQUE (tenant_id, lead_id)`. Upsert.
  - `messages_update` é um plain `UPDATE` — repetir dá sempre o mesmo resultado.
  - `connection` é plain `UPDATE`.
- Respondemos `200 OK` rapidamente (<500ms). Trabalho pesado (ex.: enriquecimento de lead via API externa) fica fora da MVP.
- Sem fila interna de retry da nossa parte — confiamos na retry da uazapi. Follow-up possível: registar payloads falhados em `webhook_dead_letters` para replay manual; não faz parte da MVP.

---

## Segurança operacional

- O URL completo com segredo (`/api/webhooks/uazapi/<secret>`) **nunca** pode aparecer em logs da aplicação. Logger sanitiza o path.
- Rotação de segredo: endpoint interno `POST /api/whatsapp/rotate-webhook-secret` (owner-only) gera novo segredo e reconfigura o webhook na uazapi. Fora da MVP se não houver pedido explícito; documentado aqui para quando for necessário.
- Em dev local, expor o server com `cloudflared tunnel` ou `ngrok` para ter um `PUBLIC_WEBHOOK_BASE_URL` acessível pela uazapi.
