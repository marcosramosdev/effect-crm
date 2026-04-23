import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { errorHandler } from './middlewares/error'
import { authMiddleware } from './middlewares/auth'
import { tenantGuard } from './middlewares/tenant-guard'
import type { AuthVariables } from './middlewares/auth'

const app = new Hono()

app.use('*', logger())
app.use('*', errorHandler())

app.get('/health', (c) => c.json({ status: 'ok' }))

const api = new Hono<{ Variables: AuthVariables }>()
api.use('*', authMiddleware)
api.use('*', tenantGuard)

// TODO: mount routes — auth
// TODO: mount routes — whatsapp
// TODO: mount routes — webhooks (public, mounted on app directly)
// TODO: mount routes — inbox
// TODO: mount routes — pipeline

app.route('/api', api)

export default app
