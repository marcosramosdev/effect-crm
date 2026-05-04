import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { errorHandler, structuredLogger } from './middlewares/error'
import { authMiddleware } from './middlewares/auth'
import { tenantGuard } from './middlewares/tenant-guard'
import type { AuthVariables } from './middlewares/auth'
import { authRouter } from './routes/auth'
import { whatsappRouter } from './routes/whatsapp'
import { webhooksRouter } from './routes/webhooks'
import { inboxRouter } from './routes/inbox'
import { pipelineRouter } from './routes/pipeline'
import { teamRouter } from './routes/team'

const UAZAPI_FREE_BASE_URL = 'https://free.uazapi.com'

function validateUazapiBootConfig() {
  const nodeEnv = process.env.NODE_ENV ?? 'development'
  const baseUrl = process.env.UAZAPI_BASE_URL ?? UAZAPI_FREE_BASE_URL
  const adminToken = (process.env.UAZAPI_ADMIN_TOKEN ?? '').trim()

  if (nodeEnv === 'production' && adminToken.length === 0) {
    throw new Error('UAZAPI_ADMIN_TOKEN obrigatório em produção')
  }

  const isUsingFreeDefaults = baseUrl === UAZAPI_FREE_BASE_URL && adminToken.length === 0
  if (nodeEnv !== 'production' && isUsingFreeDefaults) {
    console.warn('[whatsapp] Usando defaults free da UAZAPI em ambiente não-produção')
  }
}

validateUazapiBootConfig()

const app = new Hono()

app.use('*', structuredLogger())
app.use('*', errorHandler())

app.get('/health', (c) => c.json({ status: 'ok' }))

const AUTH_PUBLIC = new Set(['/api/auth/register', '/api/auth/login'])

const api = new Hono<{ Variables: AuthVariables }>()
api.use('*', async (c, next) => {
  if (AUTH_PUBLIC.has(c.req.path)) return next()
  return authMiddleware(c, next)
})
api.use('*', async (c, next) => {
  if (AUTH_PUBLIC.has(c.req.path)) return next()
  return tenantGuard(c, next)
})

api.route('/auth', authRouter)
api.route('/whatsapp', whatsappRouter)
api.route('/inbox', inboxRouter)
api.route('/pipeline', pipelineRouter)
api.route('/team', teamRouter)
// webhooks is public — mounted on app directly below

app.route('/api', api)
app.route('/', webhooksRouter)

if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './client/dist' }))
  app.get('/*', async (c) => {
    const html = await Bun.file('./client/dist/index.html').text()
    return c.html(html)
  })
}

export default app
