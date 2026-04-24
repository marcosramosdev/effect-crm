import { z } from 'zod'
import { createServiceSupabase } from '../../db/client'

type ServiceClient = Pick<ReturnType<typeof createServiceSupabase>, 'from'>

const ConnectionUpdateSchema = z.object({
  state: z.enum(['disconnected', 'connecting', 'connected']),
  phoneNumber: z.string().optional(),
  reason: z.string().optional(),
})

async function handleConnectionEvent(
  tenantId: string,
  data: unknown,
  db: ServiceClient,
): Promise<void> {
  const result = ConnectionUpdateSchema.safeParse(data)
  if (!result.success) return

  const { state, phoneNumber, reason } = result.data
  const update: Record<string, unknown> = { status: state }

  if (phoneNumber) update.phone_number = phoneNumber
  if (state === 'connected') update.last_heartbeat_at = new Date().toISOString()
  if (state === 'disconnected' && reason) update.last_error = reason

  await db.from('whatsapp_sessions').update(update).eq('tenant_id', tenantId)
}

const InboundMessageSchema = z.object({
  id: z.string(),
  chatid: z.string(),
  fromMe: z.boolean().optional(),
  messageType: z.string(),
  text: z.string().nullable().optional(),
  pushName: z.string().nullable().optional(),
  timestamp: z.number(),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any

function q(db: ServiceClient, table: string): AnyBuilder {
  return db.from(table)
}

async function handleMessagesEvent(
  tenantId: string,
  data: unknown,
  db: ServiceClient,
): Promise<void> {
  const result = InboundMessageSchema.safeParse(data)
  if (!result.success) return

  const { id: messageId, chatid, messageType, text, pushName, timestamp } = result.data

  if (chatid.endsWith('@g.us')) return

  const phoneNumber = chatid.replace('@s.whatsapp.net', '')
  const contentType = messageType === 'conversation' ? 'text' : 'unsupported'
  const messageText = contentType === 'text' ? (text ?? null) : null

  const { data: stage } = await q(db, 'pipeline_stages')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_default_entry', true)
    .single()

  if (!stage) return

  const { data: lead } = await q(db, 'leads')
    .upsert(
      {
        tenant_id: tenantId,
        phone_number: phoneNumber,
        display_name: pushName ?? null,
        stage_id: stage.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,phone_number' },
    )
    .select('id')
    .single()

  if (!lead) return

  const { data: conv } = await q(db, 'conversations')
    .upsert(
      {
        tenant_id: tenantId,
        lead_id: lead.id,
        last_message_at: new Date(timestamp * 1000).toISOString(),
      },
      { onConflict: 'lead_id' },
    )
    .select('id')
    .single()

  if (!conv) return

  const { error: msgError } = await q(db, 'messages').insert({
    tenant_id: tenantId,
    conversation_id: conv.id,
    direction: 'inbound',
    content_type: contentType,
    text: messageText,
    whatsapp_message_id: messageId,
    created_at: new Date(timestamp * 1000).toISOString(),
  })

  if (msgError?.code === '23505') return
  if (msgError) throw new Error(`Failed to insert message: ${msgError.message}`)
}

const MessageUpdateSchema = z.object({
  id: z.string(),
  status: z.enum(['PENDING', 'SERVER_ACK', 'DELIVERY_ACK', 'READ', 'FAILED']),
})

const STATUS_MAP: Record<string, 'sent' | 'delivered' | 'read' | 'failed'> = {
  SERVER_ACK: 'sent',
  DELIVERY_ACK: 'delivered',
  READ: 'read',
  FAILED: 'failed',
}

async function handleMessagesUpdateEvent(
  tenantId: string,
  data: unknown,
  db: ServiceClient,
): Promise<void> {
  const result = MessageUpdateSchema.safeParse(data)
  if (!result.success) return

  const { id: whatsappMessageId, status } = result.data
  const mapped = STATUS_MAP[status]
  if (!mapped) return

  const update: Record<string, unknown> = { status: mapped }
  if (mapped === 'read') update.read_at = new Date().toISOString()

  await q(db, 'messages')
    .update(update)
    .eq('tenant_id', tenantId)
    .eq('whatsapp_message_id', whatsappMessageId)
}

export async function handleWebhookEvent(
  tenantId: string,
  payload: { event: string; instance: string; data: unknown },
  getServiceClient: () => ServiceClient = createServiceSupabase,
): Promise<void> {
  const db = getServiceClient()

  if (payload.event === 'connection') {
    await handleConnectionEvent(tenantId, payload.data, db)
  } else if (payload.event === 'messages') {
    await handleMessagesEvent(tenantId, payload.data, db)
  } else if (payload.event === 'messages_update') {
    await handleMessagesUpdateEvent(tenantId, payload.data, db)
  }
}
