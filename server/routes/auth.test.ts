import { describe, it, expect, beforeAll } from 'bun:test'
import { Hono } from 'hono'
import { makeTestJwt } from '../test/fixtures/jwts'
import { makeSupabaseMock } from '../test/fixtures/supabase'
import { createAuthMiddleware } from '../middlewares/auth'
import { verifyTestJwt } from '../test/fixtures/jwts'
import { tenantGuard } from '../middlewares/tenant-guard'
import { errorHandler } from '../middlewares/error'
import { createAuthRouter } from './auth'

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const USER_EMAIL = 'owner@example.com'
const TENANT_NAME = 'Acme Corp'

beforeAll(() => {
  process.env.SUPABASE_JWT_SECRET = 'test-secret'
})

function makeApp(memberRows: Record<string, unknown>[], tenantRows: Record<string, unknown>[]) {
  const authMock = makeSupabaseMock({ rows: memberRows })
  const routeMock = makeSupabaseMock({ rows: tenantRows })

  const app = new Hono()
  app.use('*', errorHandler())
  app.use('*', createAuthMiddleware(() => authMock as never, verifyTestJwt))
  app.use('*', tenantGuard)

  const router = createAuthRouter(() => routeMock as never)
  app.route('/auth', router)

  return app
}

describe('GET /auth/me', () => {
  // T-S-040 variant: no JWT → 401
  it('returns 401 when Authorization header is absent', async () => {
    const app = makeApp([], [])
    const res = await app.request('/auth/me')
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns correct shape for valid JWT with membership', async () => {
    const memberRows = [{ user_id: USER_ID, tenant_id: TENANT_ID, role: 'owner' }]
    const tenantRows = [{ id: TENANT_ID, name: TENANT_NAME }]
    const jwt = await makeTestJwt({ userId: USER_ID, tenantId: TENANT_ID, email: USER_EMAIL })

    const app = makeApp(memberRows, tenantRows)
    const res = await app.request('/auth/me', {
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toMatchObject({
      userId: USER_ID,
      email: USER_EMAIL,
      tenantId: TENANT_ID,
      tenantName: TENANT_NAME,
      role: 'owner',
    })
  })
})
