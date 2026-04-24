import { Hono } from 'hono'
import { createServiceSupabase } from '../db/client'
import { WebhookEventEnvelopeSchema } from '../types/whatsapp'
import { handleWebhookEvent } from '../lib/whatsapp/webhook-handler'

type ServiceClient = Pick<ReturnType<typeof createServiceSupabase>, 'from'>

interface WebhooksDeps {
  getServiceClient?: () => ServiceClient
  handleEvent?: (tenantId: string, payload: { event: string; instance: string; data: unknown }) => Promise<void>
  log?: (msg: string) => void
}

export function createWebhooksRouter(deps: WebhooksDeps = {}) {
  const {
    getServiceClient = createServiceSupabase,
    handleEvent = handleWebhookEvent,
    log = () => {},
  } = deps

  const router = new Hono()

  router.post('/webhooks/uazapi/:webhookSecret', async (c) => {
    const { webhookSecret } = c.req.param()
    const db = getServiceClient()

    const { data: session } = await db
      .from('whatsapp_sessions')
      .select('tenant_id, uazapi_instance_id')
      .eq('uazapi_webhook_secret', webhookSecret)
      .maybeSingle()

    if (!session) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Segredo inválido' } }, 401)
    }

    const row = session as Record<string, unknown>

    // Timing-safe verification (belt-and-suspenders after DB lookup)
    const storedSecret = (row.uazapi_webhook_secret as string | undefined) ?? webhookSecret
    const provided = Buffer.from(webhookSecret)
    const stored = Buffer.from(storedSecret)
    if (
      provided.length !== stored.length ||
      !crypto.timingSafeEqual(provided, stored)
    ) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Segredo inválido' } }, 401)
    }

    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Payload inválido' } }, 400)
    }

    const envelope = WebhookEventEnvelopeSchema.safeParse(body)
    if (!envelope.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Envelope inválido' } }, 400)
    }

    if (envelope.data.instance !== row.uazapi_instance_id) {
      return c.json({ error: { code: 'INSTANCE_MISMATCH', message: 'Instance ID não coincide' } }, 400)
    }

    const tenantId = row.tenant_id as string
    log(`Webhook event=${envelope.data.event} tenant=${tenantId}`)

    await handleEvent(tenantId, envelope.data)

    return c.json({ ok: true })
  })

  return router
}

export const webhooksRouter = createWebhooksRouter()
