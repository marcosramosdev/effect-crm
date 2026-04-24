import { Hono } from 'hono'
import { createServiceSupabase } from '../db/client'
import type { AuthVariables } from '../middlewares/auth'

type ServiceClient = Pick<ReturnType<typeof createServiceSupabase>, 'from'>

export function createAuthRouter(getServiceClient: () => ServiceClient = createServiceSupabase) {
  const router = new Hono<{ Variables: AuthVariables }>()

  router.get('/me', async (c) => {
    const { userId, email, tenantId, role } = c.var

    const db = getServiceClient()
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

  return router
}

export const authRouter = createAuthRouter()
