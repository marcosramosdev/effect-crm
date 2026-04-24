import { Hono } from 'hono'
import { createServiceSupabase } from '../db/client'
import {
  createInstance,
  configureWebhook,
  connect,
  disconnect,
} from '../lib/whatsapp/uazapi-client'
import type { AuthVariables } from '../middlewares/auth'

type ServiceClient = Pick<ReturnType<typeof createServiceSupabase>, 'from'>

interface UazapiDeps {
  createInstance: typeof createInstance
  configureWebhook: typeof configureWebhook
  connect: typeof connect
  disconnect: typeof disconnect
}

export function createWhatsappRouter(
  getServiceClient: () => ServiceClient = createServiceSupabase,
  uazapiDeps: UazapiDeps = { createInstance, configureWebhook, connect, disconnect },
) {
  const router = new Hono<{ Variables: AuthVariables }>()

  router.get('/connection', async (c) => {
    const { tenantId } = c.var
    const db = getServiceClient()

    const { data, error } = await db
      .from('whatsapp_sessions')
      .select('status, phone_number, last_heartbeat_at, last_error')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao ler sessão' } }, 500)
    }

    if (!data) {
      return c.json({ status: 'disconnected', phoneNumber: null, lastHeartbeatAt: null, lastError: null })
    }

    const row = data as Record<string, unknown>
    return c.json({
      status: row.status,
      phoneNumber: row.phone_number ?? null,
      lastHeartbeatAt: row.last_heartbeat_at ?? null,
      lastError: row.last_error ?? null,
    })
  })

  router.post('/connection', async (c) => {
    const { tenantId, role } = c.var

    if (role !== 'owner') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Apenas owner pode iniciar conexão' } }, 403)
    }

    const db = getServiceClient()

    const { data: sessionData } = await db
      .from('whatsapp_sessions')
      .select('uazapi_instance_id, uazapi_instance_token, uazapi_webhook_secret, status')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const session = sessionData as Record<string, unknown> | null

    let instanceId: string
    let instanceToken: string
    let webhookSecret: string

    if (!session?.uazapi_instance_id) {
      const result = await uazapiDeps.createInstance({
        name: `crm-${tenantId}`,
        adminField01: tenantId,
      })
      instanceId = result.instanceId
      instanceToken = result.token
      webhookSecret = crypto.randomUUID()
    } else {
      instanceId = session.uazapi_instance_id as string
      instanceToken = session.uazapi_instance_token as string
      webhookSecret = (session.uazapi_webhook_secret as string | null) ?? crypto.randomUUID()
    }

    const publicBase = process.env.PUBLIC_WEBHOOK_BASE_URL ?? 'http://localhost:3000'

    await uazapiDeps.configureWebhook({
      token: instanceToken,
      url: `${publicBase}/api/webhooks/uazapi/${webhookSecret}`,
      events: ['messages', 'messages_update', 'connection'],
      excludeMessages: ['wasSentByApi'],
    })

    const { qr } = await uazapiDeps.connect(instanceToken)

    await db.from('whatsapp_sessions').upsert(
      {
        tenant_id: tenantId,
        status: 'qr_pending',
        uazapi_instance_id: instanceId,
        uazapi_instance_token: instanceToken,
        uazapi_webhook_secret: webhookSecret,
      },
      { onConflict: 'tenant_id' },
    )

    return c.json({ status: 'qr_pending', qr })
  })

  router.post('/disconnect', async (c) => {
    const { tenantId, role } = c.var

    if (role !== 'owner') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Apenas owner pode desconectar' } }, 403)
    }

    const db = getServiceClient()

    const { data: sessionData } = await db
      .from('whatsapp_sessions')
      .select('uazapi_instance_token')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const session = sessionData as Record<string, unknown> | null

    if (session?.uazapi_instance_token) {
      await uazapiDeps.disconnect(session.uazapi_instance_token as string)
    }

    await db
      .from('whatsapp_sessions')
      .update({ status: 'disconnected', last_heartbeat_at: null })
      .eq('tenant_id', tenantId)

    return c.body(null, 204)
  })

  return router
}

export const whatsappRouter = createWhatsappRouter()
