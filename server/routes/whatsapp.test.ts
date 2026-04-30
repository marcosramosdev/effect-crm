import { describe, it, expect, beforeAll } from 'bun:test'
import { Hono } from 'hono'
import { makeTestJwt } from '../test/fixtures/jwts'
import { makeSupabaseMock } from '../test/fixtures/supabase'
import { createAuthMiddleware } from '../middlewares/auth'
import { verifyTestJwt } from '../test/fixtures/jwts'
import { tenantGuard } from '../middlewares/tenant-guard'
import { errorHandler } from '../middlewares/error'
import { createWhatsappRouter } from './whatsapp'

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const INSTANCE_ID = 'inst-001'
const INSTANCE_TOKEN = 'inst-token-001'
const WEBHOOK_SECRET = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

beforeAll(() => {
  process.env.SUPABASE_JWT_SECRET = 'test-secret'
  process.env.PUBLIC_WEBHOOK_BASE_URL = 'https://example.com'
})

interface UazapiCalls {
  createInstance: unknown[]
  configureWebhook: unknown[]
  connect: string[]
  disconnect: string[]
}

function makeUazapiDeps() {
  const calls: UazapiCalls = { createInstance: [], configureWebhook: [], connect: [], disconnect: [] }

  const deps = {
    createInstance: async (params: unknown) => {
      calls.createInstance.push(params)
      return { instanceId: INSTANCE_ID, token: INSTANCE_TOKEN }
    },
    configureWebhook: async (params: unknown) => {
      calls.configureWebhook.push(params)
    },
    connect: async (token: string) => {
      calls.connect.push(token)
      return { qr: 'data:image/png;base64,qrdata', status: 'qr_pending' as const }
    },
    disconnect: async (token: string) => {
      calls.disconnect.push(token)
    },
  }

  return { deps, calls }
}

function makeApp(
  memberRows: Record<string, unknown>[],
  sessionRows: Record<string, unknown>[],
  uazapiDeps: ReturnType<typeof makeUazapiDeps>['deps'],
) {
  const authMock = makeSupabaseMock({ rows: memberRows })
  const routeMock = makeSupabaseMock({ rows: sessionRows })

  const app = new Hono()
  app.use('*', errorHandler())
  app.use('*', createAuthMiddleware(() => authMock as never, verifyTestJwt))
  app.use('*', tenantGuard)

  const router = createWhatsappRouter(() => routeMock as never, uazapiDeps)
  app.route('/whatsapp', router)

  return app
}

async function ownerJwt() {
  return makeTestJwt({ userId: USER_ID, tenantId: TENANT_ID, role: 'authenticated' })
}

const ownerMember = [{ user_id: USER_ID, tenant_id: TENANT_ID, role: 'owner' }]
const agentMember = [{ user_id: USER_ID, tenant_id: TENANT_ID, role: 'agent' }]

describe('POST /whatsapp/connection', () => {
  // T-S-070
  it('returns 403 when role is agent', async () => {
    const { deps } = makeUazapiDeps()
    const app = makeApp(agentMember, [], deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/connection', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(403)
  })

  // T-S-071
  it('provisions new instance on first connection (no existing session)', async () => {
    const { deps, calls } = makeUazapiDeps()
    const app = makeApp(ownerMember, [], deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/connection', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.status).toBe('qr_pending')
    expect(typeof body.qr).toBe('string')

    expect(calls.createInstance).toHaveLength(1)
    expect(calls.configureWebhook).toHaveLength(1)
    expect(calls.connect).toHaveLength(1)
  })

  // T-S-072
  it('reuses existing instance without calling createInstance', async () => {
    const sessionRows = [{
      tenant_id: TENANT_ID,
      uazapi_instance_id: INSTANCE_ID,
      uazapi_instance_token: INSTANCE_TOKEN,
      uazapi_webhook_secret: WEBHOOK_SECRET,
      status: 'disconnected',
    }]
    const { deps, calls } = makeUazapiDeps()
    const app = makeApp(ownerMember, sessionRows, deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/connection', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(200)
    expect(calls.createInstance).toHaveLength(0)
    expect(calls.configureWebhook).toHaveLength(1)
    expect(calls.connect).toHaveLength(1)
    expect(calls.connect[0]).toBe(INSTANCE_TOKEN)
  })
})

describe('POST /whatsapp/disconnect', () => {
  // T-S-073
  it('calls disconnect with instance token and returns 204', async () => {
    const sessionRows = [{ tenant_id: TENANT_ID, uazapi_instance_token: INSTANCE_TOKEN }]
    const { deps, calls } = makeUazapiDeps()
    const app = makeApp(ownerMember, sessionRows, deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/disconnect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(204)
    expect(calls.disconnect).toHaveLength(1)
    expect(calls.disconnect[0]).toBe(INSTANCE_TOKEN)
  })
})

describe('GET /whatsapp/connection', () => {
  // T-S-074
  it('returns only public fields (no instance_token or webhook_secret)', async () => {
    const sessionRows = [{
      tenant_id: TENANT_ID,
      status: 'connected',
      phone_number: '5511999999999',
      last_heartbeat_at: '2024-01-01T00:00:00.000Z',
      last_error: null,
      uazapi_instance_id: INSTANCE_ID,
      uazapi_instance_token: 'SECRET_TOKEN',
      uazapi_webhook_secret: 'SECRET_WEBHOOK',
    }]
    const { deps } = makeUazapiDeps()
    const app = makeApp(ownerMember, sessionRows, deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/connection', {
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.status).toBe('connected')
    expect(body.phoneNumber).toBe('5511999999999')
    expect(body.lastHeartbeatAt).toBe('2024-01-01T00:00:00.000Z')
    expect(body.lastError).toBeNull()
    expect(body.uazapi_instance_token).toBeUndefined()
    expect(body.uazapi_webhook_secret).toBeUndefined()
    expect(body.uazapiInstanceToken).toBeUndefined()
  })
})
