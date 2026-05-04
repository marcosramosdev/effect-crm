import { describe, it, expect, beforeAll } from 'bun:test'
import { Hono } from 'hono'
import { makeTestJwt } from '../test/fixtures/jwts'
import { makeSupabaseMock } from '../test/fixtures/supabase'
import { createAuthMiddleware } from '../middlewares/auth'
import { verifyTestJwt } from '../test/fixtures/jwts'
import { tenantGuard } from '../middlewares/tenant-guard'
import { errorHandler } from '../middlewares/error'
import { createWhatsappRouter } from './whatsapp'
import { UazapiRateLimitedError } from '../lib/whatsapp/uazapi-client'

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
  deleteInstance: string[]
  getInstanceStatus: string[]
}

function makeUazapiDeps() {
  const calls: UazapiCalls = {
    createInstance: [],
    configureWebhook: [],
    connect: [],
    deleteInstance: [],
    getInstanceStatus: [],
  }

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
    deleteInstance: async (token: string) => {
      calls.deleteInstance.push(token)
    },
    getInstanceStatus: async (token: string) => {
      calls.getInstanceStatus.push(token)
      return {
        status: 'connected',
        connected: true,
        loggedIn: true,
        phoneNumber: '5511999999999',
        instanceName: 'Empresa X',
      }
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

describe('POST /whatsapp/instance', () => {
  it('returns 403 when role is agent', async () => {
    const { deps } = makeUazapiDeps()
    const app = makeApp(agentMember, [], deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/instance', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ name: 'Empresa X' }),
    })

    expect(res.status).toBe(403)
  })

  it('creates instance with valid name and returns 201', async () => {
    const { deps, calls } = makeUazapiDeps()
    const app = makeApp(ownerMember, [], deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/instance', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ name: ' Empresa X ' }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.status).toBe('disconnected')
    expect(body.name).toBe('Empresa X')
    expect(body.instanceId).toBe(INSTANCE_ID)

    expect(calls.createInstance).toHaveLength(1)
    expect(calls.createInstance[0]).toEqual({ name: 'Empresa X', adminField01: TENANT_ID })
  })

  it('returns 409 when instance already exists', async () => {
    const sessionRows = [{
      tenant_id: TENANT_ID,
      uazapi_instance_id: INSTANCE_ID,
    }]
    const { deps, calls } = makeUazapiDeps()
    const app = makeApp(ownerMember, sessionRows, deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/instance', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ name: 'Empresa X' }),
    })

    expect(res.status).toBe(409)
    expect(calls.createInstance).toHaveLength(0)
  })

  it('returns 400 for invalid name', async () => {
    const { deps, calls } = makeUazapiDeps()
    const app = makeApp(ownerMember, [], deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/instance', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ name: '   ' }),
    })

    expect(res.status).toBe(400)
    expect(calls.createInstance).toHaveLength(0)
  })
})

describe('DELETE /whatsapp/instance', () => {
  it('calls deleteInstance and returns 204', async () => {
    const sessionRows = [{
      tenant_id: TENANT_ID,
      uazapi_instance_id: INSTANCE_ID,
      uazapi_instance_token: INSTANCE_TOKEN,
    }]
    const { deps, calls } = makeUazapiDeps()
    const app = makeApp(ownerMember, sessionRows, deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/instance', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(204)
    expect(calls.deleteInstance).toHaveLength(1)
    expect(calls.deleteInstance[0]).toBe(INSTANCE_TOKEN)
  })

  it('returns 404 when local instance does not exist', async () => {
    const { deps, calls } = makeUazapiDeps()
    const app = makeApp(ownerMember, [], deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/instance', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(404)
    expect(calls.deleteInstance).toHaveLength(0)
  })
})

describe('POST /whatsapp/instance/connect', () => {
  it('connects existing instance and returns qr_pending', async () => {
    const sessionRows = [{
      tenant_id: TENANT_ID,
      uazapi_instance_id: INSTANCE_ID,
      uazapi_instance_token: INSTANCE_TOKEN,
      uazapi_webhook_secret: WEBHOOK_SECRET,
    }]
    const { deps, calls } = makeUazapiDeps()
    const app = makeApp(ownerMember, sessionRows, deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/instance/connect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.status).toBe('qr_pending')
    expect(typeof body.qr).toBe('string')
    expect(typeof body.qrExpiresAt).toBe('string')
    expect(calls.configureWebhook).toHaveLength(1)
    expect(calls.connect).toHaveLength(1)
    expect(calls.connect[0]).toBe(INSTANCE_TOKEN)
  })

  it('returns 404 when trying to connect without instance', async () => {
    const { deps, calls } = makeUazapiDeps()
    const app = makeApp(ownerMember, [], deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/instance/connect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(404)
    expect(calls.configureWebhook).toHaveLength(0)
    expect(calls.connect).toHaveLength(0)
  })

  it('maps UAZAPI 429 to 503', async () => {
    const sessionRows = [{
      tenant_id: TENANT_ID,
      uazapi_instance_id: INSTANCE_ID,
      uazapi_instance_token: INSTANCE_TOKEN,
      uazapi_webhook_secret: WEBHOOK_SECRET,
    }]
    const { deps, calls } = makeUazapiDeps()
    deps.connect = async (token: string) => {
      calls.connect.push(token)
      throw new UazapiRateLimitedError()
    }
    const app = makeApp(ownerMember, sessionRows, deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/instance/connect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(503)
    const body = (await res.json()) as Record<string, unknown>
    expect((body.error as Record<string, unknown>).code).toBe('UAZAPI_OVERLOADED')
  })
})

describe('GET /whatsapp/instance/status', () => {
  it('returns disconnected defaults when there is no local row', async () => {
    const { deps } = makeUazapiDeps()
    const app = makeApp(ownerMember, [], deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/instance/status', {
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.status).toBe('disconnected')
    expect(body.instanceName).toBeNull()
    expect(body.qr).toBeNull()
  })

  it('refreshes from UAZAPI when local status is qr_pending', async () => {
    const sessionRows = [{
      tenant_id: TENANT_ID,
      status: 'qr_pending',
      uazapi_instance_token: INSTANCE_TOKEN,
      instance_name: 'Empresa X',
      qr_expires_at: '2099-01-01T00:00:00.000Z',
    }]
    const { deps, calls } = makeUazapiDeps()
    const app = makeApp(ownerMember, sessionRows, deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/instance/status', {
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.status).toBe('connected')
    expect(body.phoneNumber).toBe('5511999999999')
    expect(calls.getInstanceStatus).toHaveLength(1)
  })

  it('keeps qr_pending and returns qr null when qr has expired', async () => {
    const sessionRows = [{
      tenant_id: TENANT_ID,
      status: 'qr_pending',
      instance_name: 'Empresa X',
      qr_expires_at: '2000-01-01T00:00:00.000Z',
    }]
    const { deps, calls } = makeUazapiDeps()
    const app = makeApp(ownerMember, sessionRows, deps)
    const jwt = await ownerJwt()

    const res = await app.request('/whatsapp/instance/status', {
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.status).toBe('qr_pending')
    expect(body.qr).toBeNull()
    expect(calls.getInstanceStatus).toHaveLength(0)
  })

  it('returns only public fields (no tokens)', async () => {
    const sessionRows = [{
      tenant_id: TENANT_ID,
      status: 'connected',
      instance_name: 'Empresa X',
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

    const res = await app.request('/whatsapp/instance/status', {
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.status).toBe('connected')
    expect(body.instanceName).toBe('Empresa X')
    expect(body.phoneNumber).toBe('5511999999999')
    expect(body.lastHeartbeatAt).toBe('2024-01-01T00:00:00.000Z')
    expect(body.lastError).toBeNull()
    expect(body.qrExpiresAt).toBeNull()
    expect(body.qr).toBeNull()
    expect(body.uazapi_instance_token).toBeUndefined()
    expect(body.uazapi_webhook_secret).toBeUndefined()
    expect(body.uazapi_admin_token).toBeUndefined()
    expect(body.uazapiInstanceToken).toBeUndefined()
  })
})
