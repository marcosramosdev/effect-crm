import { Hono } from 'hono'
import { createServiceSupabase } from '../db/client'
import {
  createInstance,
  configureWebhook,
  connect,
  deleteInstance,
  getInstanceStatus,
  UazapiNotFoundError,
  UazapiRateLimitedError,
} from '../lib/whatsapp/uazapi-client'
import type { AuthVariables } from '../middlewares/auth'
import type { ConnectionStatus, CreateInstanceBody, InstanceStatusDTO } from '../types/whatsapp'
import { CreateInstanceBodySchema } from '../types/whatsapp'

type ServiceClient = Pick<ReturnType<typeof createServiceSupabase>, 'from'>
type SessionRow = Record<string, unknown>

interface UazapiDeps {
  createInstance: typeof createInstance
  configureWebhook: typeof configureWebhook
  connect: typeof connect
  deleteInstance: typeof deleteInstance
  getInstanceStatus: typeof getInstanceStatus
}

function normalizeConnectionStatus(value: unknown): ConnectionStatus {
  if (value === 'qr_pending') return 'qr_pending'
  if (value === 'connecting') return 'connecting'
  if (value === 'connected') return 'connected'
  if (value === 'error') return 'error'
  return 'disconnected'
}

function normalizeStatusFromUazapi(status: string, connected: boolean, loggedIn: boolean): ConnectionStatus {
  if (connected || loggedIn) return 'connected'
  if (status === 'qr_pending') return 'qr_pending'
  if (status === 'connecting') return 'connecting'
  if (status === 'error') return 'error'
  return 'disconnected'
}

function toStatusResponse(row: SessionRow | null): InstanceStatusDTO {
  if (!row) {
    return {
      status: 'disconnected',
      instanceName: null,
      phoneNumber: null,
      lastHeartbeatAt: null,
      lastError: null,
      qrExpiresAt: null,
      qr: null,
    }
  }

  const status = normalizeConnectionStatus(row.status)
  const qrExpiresAt = typeof row.qr_expires_at === 'string' ? row.qr_expires_at : null
  const qrExpired = qrExpiresAt ? new Date(qrExpiresAt).getTime() < Date.now() : false

  return {
    status,
    instanceName: typeof row.instance_name === 'string' ? row.instance_name : null,
    phoneNumber: typeof row.phone_number === 'string' ? row.phone_number : null,
    lastHeartbeatAt: typeof row.last_heartbeat_at === 'string' ? row.last_heartbeat_at : null,
    lastError: typeof row.last_error === 'string' ? row.last_error : null,
    qrExpiresAt,
    qr: status === 'qr_pending' && qrExpired ? null : null,
  }
}

export function createWhatsappRouter(
  getServiceClient: () => ServiceClient = createServiceSupabase,
  uazapiDeps: UazapiDeps = {
    createInstance,
    configureWebhook,
    connect,
    deleteInstance,
    getInstanceStatus,
  },
) {
  const router = new Hono<{ Variables: AuthVariables }>()

  router.post('/instance', async (c) => {
    const { tenantId, role } = c.var
    if (role !== 'owner') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Apenas owner pode criar instância' } }, 403)
    }

    const bodyResult = CreateInstanceBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!bodyResult.success) {
      return c.json({ error: { code: 'INVALID_NAME', message: 'Nome da instância inválido' } }, 400)
    }
    const body: CreateInstanceBody = bodyResult.data
    const name = body.name

    const db = getServiceClient()

    const { data: existingData, error: existingError } = await db
      .from('whatsapp_sessions')
      .select('uazapi_instance_id')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (existingError) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao ler sessão' } }, 500)
    }

    const existing = existingData as SessionRow | null
    if (existing?.uazapi_instance_id) {
      return c.json({ error: { code: 'INSTANCE_ALREADY_EXISTS', message: 'Instância já existe' } }, 409)
    }

    const created = await uazapiDeps.createInstance({ name, adminField01: tenantId })
    const webhookSecret = crypto.randomUUID()

    const { error: upsertError } = await db.from('whatsapp_sessions').upsert(
      {
        tenant_id: tenantId,
        status: 'disconnected',
        uazapi_instance_id: created.instanceId,
        uazapi_instance_token: created.token,
        uazapi_webhook_secret: webhookSecret,
        instance_name: name,
        qr_expires_at: null,
      },
      { onConflict: 'tenant_id' },
    )

    if (upsertError) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao persistir instância' } }, 500)
    }

    return c.json({ instanceId: created.instanceId, name, status: 'disconnected' }, 201)
  })

  router.delete('/instance', async (c) => {
    const { tenantId, role } = c.var

    if (role !== 'owner') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Apenas owner pode remover instância' } }, 403)
    }

    const db = getServiceClient()

    const { data: sessionData, error: sessionError } = await db
      .from('whatsapp_sessions')
      .select('uazapi_instance_id, uazapi_instance_token')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (sessionError) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao ler sessão' } }, 500)
    }

    const session = sessionData as SessionRow | null
    if (!session || !session.uazapi_instance_id || !session.uazapi_instance_token) {
      return c.json({ error: { code: 'INSTANCE_NOT_FOUND', message: 'Instância não encontrada' } }, 404)
    }

    try {
      await uazapiDeps.deleteInstance(session.uazapi_instance_token as string)
    } catch (error) {
      if (!(error instanceof UazapiNotFoundError)) {
        throw error
      }
    }

    const { error: deleteError } = await db.from('whatsapp_sessions').delete().eq('tenant_id', tenantId)
    if (deleteError) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao remover sessão local' } }, 500)
    }

    return c.body(null, 204)
  })

  router.post('/instance/connect', async (c) => {
    const { tenantId, role } = c.var

    if (role !== 'owner') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Apenas owner pode iniciar conexão' } }, 403)
    }

    const db = getServiceClient()
    const { data: sessionData, error: sessionError } = await db
      .from('whatsapp_sessions')
      .select('uazapi_instance_id, uazapi_instance_token, uazapi_webhook_secret')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (sessionError) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao ler sessão' } }, 500)
    }

    const session = sessionData as SessionRow | null
    if (!session || !session.uazapi_instance_id || !session.uazapi_instance_token) {
      return c.json({ error: { code: 'INSTANCE_NOT_FOUND', message: 'Instância não encontrada' } }, 404)
    }

    const instanceToken = session.uazapi_instance_token as string
    const webhookSecret =
      typeof session.uazapi_webhook_secret === 'string' && session.uazapi_webhook_secret.length > 0
        ? session.uazapi_webhook_secret
        : crypto.randomUUID()
    const publicBase = process.env.PUBLIC_WEBHOOK_BASE_URL ?? 'http://localhost:3000'

    try {
      await uazapiDeps.configureWebhook({
        token: instanceToken,
        url: `${publicBase}/api/webhooks/uazapi/${webhookSecret}`,
        events: ['messages', 'messages_update', 'connection'],
        excludeMessages: ['wasSentByApi'],
      })

      const { qr } = await uazapiDeps.connect(instanceToken)
      const qrExpiresAt = new Date(Date.now() + 120_000).toISOString()

      const { error: updateError } = await db
        .from('whatsapp_sessions')
        .update({
          status: 'qr_pending',
          uazapi_webhook_secret: webhookSecret,
          qr_expires_at: qrExpiresAt,
          last_error: null,
        })
        .eq('tenant_id', tenantId)

      if (updateError) {
        return c.json({ error: { code: 'INTERNAL', message: 'Erro ao atualizar sessão' } }, 500)
      }

      return c.json({ status: 'qr_pending', qr, qrExpiresAt })
    } catch (error) {
      if (error instanceof UazapiRateLimitedError) {
        return c.json(
          {
            error: {
              code: 'UAZAPI_OVERLOADED',
              message: 'Servidor UAZAPI sobrecarregado. Tente novamente em instantes.',
            },
          },
          503,
        )
      }
      throw error
    }
  })

  router.get('/instance/status', async (c) => {
    const { tenantId } = c.var
    const db = getServiceClient()

    const { data: sessionData, error } = await db
      .from('whatsapp_sessions')
      .select('status, instance_name, phone_number, last_heartbeat_at, last_error, qr_expires_at, uazapi_instance_token')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao ler sessão' } }, 500)
    }

    if (!sessionData) {
      return c.json(toStatusResponse(null))
    }

    let session = sessionData as SessionRow
    const status = normalizeConnectionStatus(session.status)
    const token = typeof session.uazapi_instance_token === 'string' ? session.uazapi_instance_token : null

    if ((status === 'qr_pending' || status === 'connecting') && token) {
      const uazapiStatus = await uazapiDeps.getInstanceStatus(token)
      const nextStatus = normalizeStatusFromUazapi(
        uazapiStatus.status,
        uazapiStatus.connected,
        uazapiStatus.loggedIn,
      )

      const update: SessionRow = {
        status: nextStatus,
        phone_number: uazapiStatus.phoneNumber,
        instance_name:
          uazapiStatus.instanceName ??
          (typeof session.instance_name === 'string' ? session.instance_name : null),
      }

      if (nextStatus === 'connected') {
        update.last_heartbeat_at = new Date().toISOString()
        update.qr_expires_at = null
        update.last_error = null
      }

      const { error: updateError } = await db.from('whatsapp_sessions').update(update).eq('tenant_id', tenantId)
      if (updateError) {
        return c.json({ error: { code: 'INTERNAL', message: 'Erro ao atualizar status' } }, 500)
      }

      session = { ...session, ...update }
    }

    return c.json(toStatusResponse(session))
  })

  return router
}

export const whatsappRouter = createWhatsappRouter()
