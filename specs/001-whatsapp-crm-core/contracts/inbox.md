# Inbox Contracts — `/api/inbox/*`

Suporta US2 (inbox) e US3 (resposta). Qualquer membro do tenant pode ler/escrever.

**Real-time nota**: a listagem e o histórico de uma conversa vêm do server; as actualizações incrementais (novas mensagens, unread counter) chegam ao client via Supabase Realtime subscrito directamente às tabelas `conversations` e `messages`. Estes endpoints REST servem o estado inicial e as acções (enviar, marcar lida).

---

## `GET /api/inbox/conversations`

Lista conversas do tenant, ordenadas por `last_message_at desc`.

**Auth**: obrigatória.

**Query params**

```ts
ListConversationsQuery = z.object({
  cursor: z.string().datetime().optional(), // paginação por last_message_at
  limit: z.coerce.number().int().min(1).max(100).default(50),
  unreadOnly: z.coerce.boolean().default(false),
  search: z.string().trim().min(1).optional(), // nome ou telefone
})
```

**Response 200**

```ts
ConversationListResponseSchema = z.object({
  conversations: z.array(ConversationSummarySchema),
  nextCursor: z.string().datetime().nullable(),
})

ConversationSummarySchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  leadDisplayName: z.string().nullable(),
  leadPhoneNumber: z.string(),
  lastMessagePreview: z.string(), // primeiros ~120 chars da última mensagem
  lastMessageAt: z.string().datetime(),
  unreadCount: z.number().int().nonnegative(),
  stageId: z.string().uuid(),
})
```

---

## `GET /api/inbox/conversations/:conversationId`

Histórico completo (ou paginado) de uma conversa. Inclui metadados do lead.

**Auth**: obrigatória (membro do tenant, e `conversations.tenant_id = ctx.tenantId` — garantido por RLS).

**Query params**

```ts
ListMessagesQuery = z.object({
  beforeCursor: z.string().datetime().optional(), // paginação histórica
  limit: z.coerce.number().int().min(1).max(200).default(100),
})
```

**Response 200**

```ts
ConversationDetailSchema = z.object({
  id: z.string().uuid(),
  lead: LeadSchema,
  messages: z.array(MessageSchema),
  nextBeforeCursor: z.string().datetime().nullable(),
})

MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  direction: z.enum(['inbound', 'outbound']),
  contentType: z.enum(['text', 'unsupported']),
  text: z.string().nullable(),
  sentByUserId: z.string().uuid().nullable(),
  status: z.enum(['pending', 'sent', 'delivered', 'read', 'failed']).nullable(),
  error: z.string().nullable(),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
})
```

**Response 404**: conversa não existe ou pertence a outro tenant (RLS devolve zero rows → 404).

---

## `POST /api/inbox/conversations/:conversationId/messages`

Envia uma mensagem de texto ao lead.

**Auth**: obrigatória.

**Request**

```ts
SendMessageRequestSchema = z.object({
  text: z.string().trim().min(1).max(4096),
})
```

**Response 202 Accepted**

```ts
SendMessageResponseSchema = z.object({
  message: MessageSchema, // com status='pending' inicialmente
})
```

Comportamento:

1. Validar que a conversa pertence ao tenant.
2. Verificar rate limit (`server/lib/whatsapp/rate-limiter.ts`) → se excedido, 429 com `Retry-After`.
3. Verificar que `whatsapp_sessions.status = 'connected'` → se não, 409 `WHATSAPP_DISCONNECTED`.
4. Inserir `messages` com `status='pending'`, `direction='outbound'`, `sent_by_user_id = ctx.userId`.
5. Dispatch ao adapter uazapi (`whatsapp.sendText`) → `POST {UAZAPI_BASE_URL}/send/text` com header `token` do tenant e body `{ number, text }`. A uazapi devolve `{ id, ... }` — guardamos esse `id` como `messages.whatsapp_message_id`. Transições subsequentes (`sent/delivered/read/failed`) chegam por webhook `messages_update` (ver `webhooks.md`).
6. Clientes subscreveram via Realtime → recebem a transição de estado automaticamente.

**Response 409**: `WHATSAPP_DISCONNECTED` ou `conversation.lead` apagado entretanto.
**Response 429**: rate limited.

---

## `POST /api/inbox/conversations/:conversationId/read`

Marca todas as mensagens inbound não lidas desta conversa como lidas.

**Auth**: obrigatória.

**Response 200**

```ts
MarkReadResponseSchema = z.object({
  conversationId: z.string().uuid(),
  unreadCount: z.literal(0),
})
```

Comportamento: `update messages set read_at = now() where conversation_id = $1 and direction='inbound' and read_at is null; update conversations set unread_count = 0 where id = $1;` — em transacção.
