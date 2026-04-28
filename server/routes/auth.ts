import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createClient } from '@supabase/supabase-js'
import { createServiceSupabase } from '../db/client'
import { RegisterRequestSchema, LoginRequestSchema } from '../types/auth'
import type { AuthVariables } from '../middlewares/auth'
import type { RegisterRequest, LoginRequest, AuthSession } from '../types/auth'
import { registerOwner } from '../lib/auth/register'
import { mapSupabaseError } from '../lib/auth/error-mapping'

type ServiceClient = Pick<ReturnType<typeof createServiceSupabase>, 'from'>

async function defaultLogoutFn(jwt: string): Promise<void> {
  const client = createServiceSupabase()
  const { error } = await client.auth.admin.signOut(jwt)
  if (error) throw new Error(error.message)
}

function defaultRegisterFn(input: RegisterRequest): Promise<AuthSession> {
  const serviceClient = createServiceSupabase()
  const anonClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  })
  return registerOwner(input, {
    adminClient: serviceClient,
    dbClient: serviceClient,
    anonClient,
  })
}

async function defaultLoginFn(input: LoginRequest): Promise<AuthSession> {
  const anonClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  })
  const { data, error } = await anonClient.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })
  if (error || !data.session) {
    throw new Error(error?.message ?? 'sign_in_failed')
  }
  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
  }
}

export function createAuthRouter(
  getServiceClient?: () => ServiceClient,
  registerFn?: (input: RegisterRequest) => Promise<AuthSession>,
  loginFn?: (input: LoginRequest) => Promise<AuthSession>,
  logoutFn?: (jwt: string) => Promise<void>,
) {
  const getClient = getServiceClient ?? createServiceSupabase
  const doRegister = registerFn ?? defaultRegisterFn
  const doLogin = loginFn ?? defaultLoginFn
  const doLogout = logoutFn ?? defaultLogoutFn

  const router = new Hono<{ Variables: AuthVariables }>()

  router.get('/me', async (c) => {
    const { userId, email, tenantId, role } = c.var

    const db = getClient()
    const { data, error } = await db.from('tenants').select('name').eq('id', tenantId).single()

    if (error || !data) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Tenant não encontrado' } }, 404)
    }

    return c.json({
      userId,
      email,
      tenantId,
      tenantName: (data as Record<string, unknown>).name as string,
      role,
    })
  })

  router.post(
    '/register',
    zValidator('json', RegisterRequestSchema, (result, c) => {
      if (!result.success) {
        const field = result.error.issues[0]?.path[0]
        if (field === 'password') {
          return c.json(
            { error: { code: 'WEAK_PASSWORD', message: 'Senha não cumpre os requisitos mínimos.' } },
            400,
          )
        }
        if (field === 'tenantName') {
          return c.json(
            {
              error: {
                code: 'TENANT_NAME_INVALID',
                message: 'Nome da empresa inválido (2–80 caracteres).',
              },
            },
            400,
          )
        }
        return c.json({ error: { code: 'UNKNOWN', message: 'Dados inválidos.' } }, 400)
      }
    }),
    async (c) => {
      const body = c.req.valid('json')
      try {
        const session = await doRegister(body)
        return c.json(session, 201)
      } catch (err) {
        const { httpStatus, code, message } = mapSupabaseError(err)
        return c.json(
          { error: { code, message } },
          httpStatus as Parameters<typeof c.json>[1],
        )
      }
    },
  )

  router.post(
    '/login',
    zValidator('json', LoginRequestSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          { error: { code: 'INVALID_CREDENTIALS', message: 'Email ou senha inválidos.' } },
          401,
        )
      }
    }),
    async (c) => {
      const body = c.req.valid('json')
      try {
        const session = await doLogin(body)
        return c.json(session, 200)
      } catch (err) {
        const { httpStatus, code, message } = mapSupabaseError(err)
        return c.json(
          { error: { code, message } },
          httpStatus as Parameters<typeof c.json>[1],
        )
      }
    },
  )

  router.post('/logout', async (c) => {
    const jwt = c.var.jwt
    try {
      await doLogout(jwt)
    } catch {
      // idempotent — 204 regardless of revocation state
    }
    return c.body(null, 204)
  })

  return router
}

export const authRouter = createAuthRouter()
