import type { MiddlewareHandler } from 'hono'
import type { AuthVariables } from './auth'

export const tenantGuard: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  if (!c.var.tenantId) {
    return c.json({ error: { code: 'INTERNAL', message: 'Tenant context em falta' } }, 500)
  }
  await next()
}
