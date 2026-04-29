import type { MiddlewareHandler } from 'hono'
import { createServiceSupabase } from '../db/client'

export type AuthVariables = {
  userId: string
  email: string
  tenantId: string
  role: 'owner' | 'agent'
  jwt: string
}

export type VerifiedUser = { id: string; email: string }

async function defaultVerifyToken(jwt: string): Promise<VerifiedUser | null> {
  const admin = createServiceSupabase()
  const { data: { user }, error } = await admin.auth.getUser(jwt)
  if (error || !user) return null
  return { id: user.id, email: user.email ?? '' }
}

type ServiceClient = Pick<ReturnType<typeof createServiceSupabase>, 'from'>

export function createAuthMiddleware(
  getServiceClient: () => ServiceClient = createServiceSupabase,
  verifyToken: (jwt: string) => Promise<VerifiedUser | null> = defaultVerifyToken,
): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authorization header ausente ou inválido' } }, 401)
    }

    const jwt = authHeader.slice(7)
    const user = await verifyToken(jwt)

    if (!user) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'JWT inválido ou expirado' } }, 401)
    }

    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from('tenant_members')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error || !data) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Utilizador sem membership no tenant' } }, 403)
    }

    c.set('userId', user.id)
    c.set('email', user.email)
    c.set('tenantId', (data as Record<string, unknown>).tenant_id as string)
    c.set('role', (data as Record<string, unknown>).role as 'owner' | 'agent')
    c.set('jwt', jwt)

    await next()
  }
}

export const authMiddleware = createAuthMiddleware()
