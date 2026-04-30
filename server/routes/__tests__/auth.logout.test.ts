import { describe, it, expect, mock, beforeAll } from 'bun:test'
import { Hono } from 'hono'
import { makeTestJwt } from '../../test/fixtures/jwts'
import { makeSupabaseMock } from '../../test/fixtures/supabase'
import { createAuthMiddleware } from '../../middlewares/auth'
import { verifyTestJwt } from '../../test/fixtures/jwts'
import { tenantGuard } from '../../middlewares/tenant-guard'
import { errorHandler } from '../../middlewares/error'
import { createAuthRouter } from '../auth'

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const USER_EMAIL = 'owner@example.com'

beforeAll(() => {
  process.env.SUPABASE_JWT_SECRET = 'test-secret'
})

function makeApp(logoutFn: (jwt: string) => Promise<void>) {
  const memberRows = [{ user_id: USER_ID, tenant_id: TENANT_ID, role: 'owner' }]
  const authMock = makeSupabaseMock({ rows: memberRows })
  const routeMock = makeSupabaseMock({ rows: [] })

  const app = new Hono()
  app.use('*', errorHandler())
  app.use('*', createAuthMiddleware(() => authMock as never, verifyTestJwt))
  app.use('*', tenantGuard)
  const router = createAuthRouter(() => routeMock as never, undefined, undefined, logoutFn)
  app.route('/auth', router)
  return app
}

describe('POST /auth/logout', () => {
  it('204 com Bearer válido', async () => {
    const logoutFn = mock(async (_jwt: string) => {})
    const jwt = await makeTestJwt({ userId: USER_ID, tenantId: TENANT_ID, email: USER_EMAIL })
    const app = makeApp(logoutFn)

    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(204)
    expect(logoutFn).toHaveBeenCalledWith(jwt)
  })

  it('204 idempotente quando token já revogado (logoutFn lança)', async () => {
    const logoutFn = mock(async (_jwt: string): Promise<void> => {
      throw Object.assign(new Error('session_not_found'), {})
    })
    const jwt = await makeTestJwt({ userId: USER_ID, tenantId: TENANT_ID, email: USER_EMAIL })
    const app = makeApp(logoutFn)

    const res = await app.request('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(204)
  })

  it('401 sem Authorization header', async () => {
    const logoutFn = mock(async (_jwt: string) => {})
    const app = makeApp(logoutFn)

    const res = await app.request('/auth/logout', { method: 'POST' })

    expect(res.status).toBe(401)
    expect(logoutFn).not.toHaveBeenCalled()
  })
})
