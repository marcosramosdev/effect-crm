import { describe, it, expect } from 'bun:test'
import { Hono } from 'hono'
import { makeTestJwt, verifyTestJwt } from '../test/fixtures/jwts'
import { makeSupabaseMock } from '../test/fixtures/supabase'
import { createAuthMiddleware } from './auth'
import type { AuthVariables } from './auth'
import { errorHandler } from './error'

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function makeApp(memberRows: Record<string, unknown>[]) {
  const mock = makeSupabaseMock({ rows: memberRows })
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', errorHandler())
  app.use('*', createAuthMiddleware(() => mock as never, verifyTestJwt))
  app.get('/test', (c) =>
    c.json({ userId: c.get('userId'), tenantId: c.get('tenantId'), role: c.get('role') }),
  )
  return app
}

describe('auth middleware', () => {
  // T-S-040
  it('returns 401 when Authorization header is absent', async () => {
    const app = makeApp([])
    const res = await app.request('/test')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  // T-S-041
  it('returns 401 for JWT signed with wrong secret', async () => {
    const wrongHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const wrongPayload = Buffer.from(
      JSON.stringify({ sub: USER_ID, exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url')
    const signingInput = `${wrongHeader}.${wrongPayload}`
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('wrong-secret'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput))
    const badJwt = `${signingInput}.${Buffer.from(sig).toString('base64url')}`

    const app = makeApp([])
    const res = await app.request('/test', { headers: { Authorization: `Bearer ${badJwt}` } })
    expect(res.status).toBe(401)
  })

  // T-S-042
  it('returns 403 when user has no tenant membership', async () => {
    const jwt = await makeTestJwt({ userId: USER_ID })
    const app = makeApp([])
    const res = await app.request('/test', { headers: { Authorization: `Bearer ${jwt}` } })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  // T-S-043
  it('attaches userId, tenantId and role to context when membership exists', async () => {
    const jwt = await makeTestJwt({ userId: USER_ID })
    const app = makeApp([{ user_id: USER_ID, tenant_id: TENANT_ID, role: 'owner' }])
    const res = await app.request('/test', { headers: { Authorization: `Bearer ${jwt}` } })
    expect(res.status).toBe(200)
    const body = await res.json() as { userId: string; tenantId: string; role: string }
    expect(body.userId).toBe(USER_ID)
    expect(body.tenantId).toBe(TENANT_ID)
    expect(body.role).toBe('owner')
  })
})
