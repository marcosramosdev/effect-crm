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
import { pipelineRouter } from './routes/pipeline'
import { teamRouter } from './routes/team'

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
api.route('/pipeline', pipelineRouter)
api.route('/team', teamRouter)
// webhooks is public — mounted on app directly below

app.route('/api', api)
app.route('/', webhooksRouter)

export default app
