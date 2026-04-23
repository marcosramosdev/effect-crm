# WhatsApp Contracts — `/api/whatsapp/*`

Suporta US1 (conectar WhatsApp). Apenas `owner` pode iniciar ou terminar ligação; `agent` pode ler o estado.

**Backing service**: todos os endpoints abaixo são servidos *para* o cliente do CRM pelo nosso server, mas internamente são forwards finos para a API uazapiGO (`https://{free|api}.uazapi.com`). O nosso server adiciona: autenticação/autorização por JWT Supabase, mapeamento `tenant_id → uazapi_instance_token`, provisioning da instância na primeira chamada, e registo do webhook per-tenant.

---

## `GET /api/whatsapp/connection`

Estado actual da ligação WhatsApp do tenant.

**Auth**: obrigatória (qualquer membro do tenant).

**Response 200**

```ts
ConnectionResponseSchema = z.object({
  status: z.enum(['disconnected', 'qr_pending', 'connecting', 'connected', 'error']),
  phoneNumber: z.string().nullable(),
  lastHeartbeatAt: z.string().datetime().nullable(),
  lastError: z.string().nullable(),
})
```

---

## `POST /api/whatsapp/connection`

Inicia o fluxo de conexão. Se já existe sessão activa, não recria.

**Auth**: obrigatória, `role = owner`.

**Request body**: vazio.

**Response 200**

```ts
StartConnectionResponseSchema = z.object({
  status: z.enum(['qr_pending', 'connecting', 'connected']),
  qr: z.string().nullable(), // data URL do QR quando status='qr_pending'
})
```

- Quando `status='qr_pending'`, o client mostra o QR. A uazapi emite QRs com validade de 120s; se expirar, o client chama de novo este endpoint para obter um QR fresco. O estado (`qr_pending → connecting → connected`) chega ao client via Supabase Realtime subscrito à view `whatsapp_sessions_public`; o valor do QR em si vem sempre do retorno deste endpoint (a view pública não expõe o QR).

**Response 403**: user é `agent`.
**Response 409**: já há uma sessão `connected`; devolver `{ status: 'connected', qr: null }` é OK em vez de 409 — handler decide.
**Response 429**: uazapi recusou por limite de instâncias simultâneas no servidor dela (mais comum em `free.uazapi.com`).

### Nota de implementação (uazapi)

O handler do server executa a seguinte lógica ao receber `POST /api/whatsapp/connection`:

1. Carrega `whatsapp_sessions` do tenant via service-role.
2. Se `uazapi_instance_id` for `null` (primeira vez): chama `POST {UAZAPI_BASE_URL}/instance/create` com header `admintoken: {UAZAPI_ADMIN_TOKEN}` e body `{ name: "crm-<tenantId>", adminField01: tenantId }`. Guarda `instance.id` e o `token` devolvido em `whatsapp_sessions.uazapi_instance_id` / `.uazapi_instance_token`. Gera `uazapi_webhook_secret = crypto.randomUUID()` e guarda-o.
3. Configura (ou reconfigura) o webhook da instância: `POST {UAZAPI_BASE_URL}/webhook` com header `token: {uazapi_instance_token}` e body:

   ```json
   {
     "enabled": true,
     "url": "{PUBLIC_WEBHOOK_BASE_URL}/api/webhooks/uazapi/{uazapi_webhook_secret}",
     "events": ["messages", "messages_update", "connection"],
     "excludeMessages": ["wasSentByApi"]
   }
   ```

4. Chama `POST {UAZAPI_BASE_URL}/instance/connect` com header `token` e body vazio (queremos QR, não pairing-code). A resposta contém o QR base64.
5. Actualiza `whatsapp_sessions.status = 'qr_pending'` e devolve `{ status: 'qr_pending', qr: <data_url> }` ao client.
6. Transições subsequentes (`connecting` → `connected`) chegam pelo webhook de evento `connection` (ver `webhooks.md`), que actualiza `whatsapp_sessions`; o client recebe as mudanças via Supabase Realtime (na view `whatsapp_sessions_public`).

---

## `POST /api/whatsapp/disconnect`

Termina a ligação actual e limpa credenciais.

**Auth**: obrigatória, `role = owner`.

**Response 204**: No content.

**Response 403**: user é `agent`.

Side-effects:

- Server chama `POST {UAZAPI_BASE_URL}/instance/disconnect` com header `token: {uazapi_instance_token}`.
- Actualiza `whatsapp_sessions.status = 'disconnected'`, `last_heartbeat_at = null`.
- Mantém `uazapi_instance_id` e `uazapi_instance_token` intactos (a instância uazapi fica viva mas desconectada do WhatsApp — reconectar é só novo QR, sem re-provisionar instância).
- Endpoint `POST /api/inbox/.../messages` começa a devolver 409 com `code: WHATSAPP_DISCONNECTED` até nova ligação.
