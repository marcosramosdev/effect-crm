import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { errorHandler } from './middlewares/error'
import { authMiddleware } from './middlewares/auth'
import { tenantGuard } from './middlewares/tenant-guard'
import type { AuthVariables } from './middlewares/auth'
import { authRouter } from './routes/auth'
import { whatsappRouter } from './routes/whatsapp'
import { webhooksRouter } from './routes/webhooks'
import { inboxRouter } from './routes/inbox'

const app = new Hono()

app.use('*', logger())
app.use('*', errorHandler())

app.get('/health', (c) => c.json({ status: 'ok' }))

const api = new Hono<{ Variables: AuthVariables }>()
api.use('*', authMiddleware)
api.use('*', tenantGuard)

api.route('/auth', authRouter)
api.route('/whatsapp', whatsappRouter)
api.route('/inbox', inboxRouter)
// webhooks is public — mounted on app directly below
// TODO: mount routes — pipeline

app.route('/api', api)
app.route('/', webhooksRouter)

export default app
