import { describe, it, expect, mock, beforeAll } from 'bun:test'
import { Hono } from 'hono'
import { errorHandler } from '../../middlewares/error'
import { createAuthRouter } from '../auth'
import { AuthSessionSchema, AuthErrorBodySchema } from '../../types/auth'
import type { RegisterRequest, AuthSession } from '../../types/auth'

beforeAll(() => {
  process.env.SUPABASE_JWT_SECRET = 'test-secret'
})

const VALID_BODY: RegisterRequest = {
  email: 'owner@example.com',
  password: 'password123',
  tenantName: 'Acme Corp',
}

function makeApp(registerFn: (input: RegisterRequest) => Promise<AuthSession>) {
  const app = new Hono()
  app.use('*', errorHandler())
  const router = createAuthRouter(undefined, registerFn)
  app.route('/auth', router)
  return app
}

describe('POST /auth/register', () => {
  it('201 + AuthSession em sucesso', async () => {
    const registerFn = mock(async (_input: RegisterRequest): Promise<AuthSession> => ({
      accessToken: 'tok_a',
      refreshToken: 'tok_r',
      expiresAt: 9999999999,
    }))

    const app = makeApp(registerFn)
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(() => AuthSessionSchema.parse(body)).not.toThrow()
  })

  it('400 WEAK_PASSWORD quando password < 8 chars', async () => {
    const registerFn = mock(async (_input: RegisterRequest): Promise<AuthSession> => ({
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
    }))

    const app = makeApp(registerFn)
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_BODY, password: 'weak' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    const parsed = AuthErrorBodySchema.parse(body)
    expect(parsed.error.code).toBe('WEAK_PASSWORD')
  })

  it('400 TENANT_NAME_INVALID quando tenantName < 2 chars', async () => {
    const registerFn = mock(async (_input: RegisterRequest): Promise<AuthSession> => ({
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
    }))

    const app = makeApp(registerFn)
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_BODY, tenantName: 'x' }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    const parsed = AuthErrorBodySchema.parse(body)
    expect(parsed.error.code).toBe('TENANT_NAME_INVALID')
  })

  it('409 EMAIL_EXISTS_OR_INVALID quando registerFn lança email_exists', async () => {
    const registerFn = mock(async (_input: RegisterRequest): Promise<AuthSession> => {
      throw Object.assign(new Error('email_exists'), {})
    })

    const app = makeApp(registerFn)
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    const parsed = AuthErrorBodySchema.parse(body)
    expect(parsed.error.code).toBe('EMAIL_EXISTS_OR_INVALID')
  })

  it('429 RATE_LIMITED quando registerFn lança com status 429', async () => {
    const registerFn = mock(async (_input: RegisterRequest): Promise<AuthSession> => {
      throw Object.assign(new Error('rate limited'), { status: 429 })
    })

    const app = makeApp(registerFn)
    const res = await app.request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })

    expect(res.status).toBe(429)
    const body = await res.json()
    const parsed = AuthErrorBodySchema.parse(body)
    expect(parsed.error.code).toBe('RATE_LIMITED')
  })
})
