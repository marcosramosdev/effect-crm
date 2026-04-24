import { describe, it, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { makeSupabaseMock } from '../test/fixtures/supabase'
import { errorHandler } from '../middlewares/error'
import { createWebhooksRouter } from './webhooks'

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const INSTANCE_ID = 'inst-001'
const WEBHOOK_SECRET = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

const validSessionRows = [{
  tenant_id: TENANT_ID,
  uazapi_instance_id: INSTANCE_ID,
  uazapi_webhook_secret: WEBHOOK_SECRET,
}]

function makeApp(
  sessionRows: Record<string, unknown>[],
  handleEvent: (tenantId: string, payload: unknown) => Promise<void> = async () => {},
  log: (msg: string) => void = () => {},
) {
  const routeMock = makeSupabaseMock({ rows: sessionRows })

  const app = new Hono()
  app.use('*', errorHandler())

  const router = createWebhooksRouter({
    getServiceClient: () => routeMock as never,
    handleEvent,
    log,
  })
  app.route('/', router)

  return app
}

function validEnvelope(instance = INSTANCE_ID) {
  return JSON.stringify({
    event: 'connection',
    instance,
    data: { state: 'connected' },
  })
}

describe('POST /webhooks/uazapi/:webhookSecret', () => {
  // T-S-030
  it('returns 401 for an invalid (unknown) webhook secret', async () => {
    const app = makeApp([])
    const res = await app.request('/webhooks/uazapi/unknown-secret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: validEnvelope(),
    })

    expect(res.status).toBe(401)
  })

  // T-S-031
  it('returns 400 INSTANCE_MISMATCH when envelope.instance does not match session', async () => {
    const app = makeApp(validSessionRows)
    const res = await app.request(`/webhooks/uazapi/${WEBHOOK_SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: validEnvelope('inst-other'),
    })

    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('INSTANCE_MISMATCH')
  })

  // T-S-032
  it('returns 200 and dispatches event for valid secret and payload', async () => {
    const dispatchedEvents: Array<{ tenantId: string; payload: unknown }> = []

    const app = makeApp(validSessionRows, async (tenantId, payload) => {
      dispatchedEvents.push({ tenantId, payload })
    })

    const res = await app.request(`/webhooks/uazapi/${WEBHOOK_SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: validEnvelope(),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
    expect(dispatchedEvents).toHaveLength(1)
    expect(dispatchedEvents[0].tenantId).toBe(TENANT_ID)
  })

  // T-S-033
  it('does not expose webhook secret in log output', async () => {
    const loggedMessages: string[] = []
    const app = makeApp(validSessionRows, async () => {}, (msg) => loggedMessages.push(msg))

    await app.request(`/webhooks/uazapi/${WEBHOOK_SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: validEnvelope(),
    })

    for (const msg of loggedMessages) {
      expect(msg).not.toContain(WEBHOOK_SECRET)
    }
  })
})
