import type { MiddlewareHandler } from 'hono'
import { createServiceSupabase } from '../db/client'

export type AuthVariables = {
  userId: string
  tenantId: string
  role: 'owner' | 'agent'
  jwt: string
}

async function verifyJwt(token: string): Promise<Record<string, unknown> | null> {
  const secret = process.env.SUPABASE_JWT_SECRET ?? ''
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [headerB64, payloadB64, sigB64] = parts
  const signingInput = `${headerB64}.${payloadB64}`

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )

    const sigBytes = Buffer.from(sigB64, 'base64url')
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(signingInput))

    if (!valid) return null

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as Record<string, unknown>

    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null

    return payload
  } catch {
    return null
  }
}

type ServiceClient = Pick<ReturnType<typeof createServiceSupabase>, 'from'>

export function createAuthMiddleware(
  getServiceClient: () => ServiceClient = createServiceSupabase,
): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authorization header ausente ou inválido' } }, 401)
    }

    const jwt = authHeader.slice(7)
    const payload = await verifyJwt(jwt)

    if (!payload) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'JWT inválido ou expirado' } }, 401)
    }

    const userId = payload.sub as string
    const supabase = getServiceClient()

    const { data, error } = await supabase
      .from('tenant_members')
      .select('tenant_id, role')
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !data) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Utilizador sem membership no tenant' } }, 403)
    }

    c.set('userId', userId)
    c.set('tenantId', (data as Record<string, unknown>).tenant_id as string)
    c.set('role', (data as Record<string, unknown>).role as 'owner' | 'agent')
    c.set('jwt', jwt)

    await next()
  }
}

export const authMiddleware = createAuthMiddleware()
