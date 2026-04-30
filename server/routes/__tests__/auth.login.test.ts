import { describe, it, expect, mock, beforeAll } from 'bun:test'
import { Hono } from 'hono'
import { errorHandler } from '../../middlewares/error'
import { createAuthRouter } from '../auth'
import { AuthSessionSchema, AuthErrorBodySchema } from '../../types/auth'
import type { LoginRequest, AuthSession } from '../../types/auth'

beforeAll(() => {
  process.env.SUPABASE_JWT_SECRET = 'test-secret'
})

const VALID_BODY: LoginRequest = {
  email: 'owner@example.com',
  password: 'password123',
}

function makeApp(loginFn: (input: LoginRequest) => Promise<AuthSession>) {
  const app = new Hono()
  app.use('*', errorHandler())
  const router = createAuthRouter(undefined, undefined, loginFn)
  app.route('/auth', router)
  return app
}

describe('POST /auth/login', () => {
  it('200 + AuthSession em credenciais válidas', async () => {
    const loginFn = mock(async (_input: LoginRequest): Promise<AuthSession> => ({
      accessToken: 'tok_a',
      refreshToken: 'tok_r',
      expiresAt: 9999999999,
    }))

    const app = makeApp(loginFn)
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(() => AuthSessionSchema.parse(body)).not.toThrow()
  })

  it('401 INVALID_CREDENTIALS quando loginFn lança user_not_found', async () => {
    const loginFn = mock(async (_input: LoginRequest): Promise<AuthSession> => {
      throw Object.assign(new Error('user_not_found'), {})
    })

    const app = makeApp(loginFn)
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })

    expect(res.status).toBe(401)
    const body = await res.json()
    const parsed = AuthErrorBodySchema.parse(body)
    expect(parsed.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('401 INVALID_CREDENTIALS quando loginFn lança invalid_grant', async () => {
    const loginFn = mock(async (_input: LoginRequest): Promise<AuthSession> => {
      throw Object.assign(new Error('invalid_grant'), {})
    })

    const app = makeApp(loginFn)
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })

    expect(res.status).toBe(401)
    const body = await res.json()
    const parsed = AuthErrorBodySchema.parse(body)
    expect(parsed.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('401 INVALID_CREDENTIALS para email mal-formado (não 400)', async () => {
    const loginFn = mock(async (_input: LoginRequest): Promise<AuthSession> => ({
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
    }))

    const app = makeApp(loginFn)
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_BODY, email: 'not-an-email' }),
    })

    expect(res.status).toBe(401)
    const body = await res.json()
    const parsed = AuthErrorBodySchema.parse(body)
    expect(parsed.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('429 RATE_LIMITED quando loginFn lança com status 429', async () => {
    const loginFn = mock(async (_input: LoginRequest): Promise<AuthSession> => {
      throw Object.assign(new Error('rate limited'), { status: 429 })
    })

    const app = makeApp(loginFn)
    const res = await app.request('/auth/login', {
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
