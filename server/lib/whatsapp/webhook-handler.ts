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

export async function handleWebhookEvent(
  tenantId: string,
  payload: { event: string; instance: string; data: unknown },
  getServiceClient: () => ServiceClient = createServiceSupabase,
): Promise<void> {
  const db = getServiceClient()

  if (payload.event === 'connection') {
    await handleConnectionEvent(tenantId, payload.data, db)
  }
}
