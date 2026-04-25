import { describe, it, expect } from 'bun:test'
import { Hono } from 'hono'
import { structuredLogger, errorHandler, sanitizePath, ApiError } from './error'

// Minimal fake context for testing middleware directly (bypasses Hono dispatch)
function makeCtx(path = '/test') {
  const raw = new Request(`http://localhost${path}`)
  return {
    req: { raw, path, method: 'GET' },
    json: (body: unknown, status: number) => new Response(JSON.stringify(body), { status }),
  }
}

describe('sanitizePath', () => {
  it('redacts webhook secret segment', () => {
    expect(sanitizePath('/api/webhooks/uazapi/abc-secret-123')).toBe(
      '/api/webhooks/uazapi/[REDACTED]',
    )
  })

  it('leaves other paths unchanged', () => {
    expect(sanitizePath('/api/pipeline/leads')).toBe('/api/pipeline/leads')
    expect(sanitizePath('/api/inbox/conversations')).toBe('/api/inbox/conversations')
  })

  it('does not expose the secret value', () => {
    const result = sanitizePath('/api/webhooks/uazapi/super-secret-token')
    expect(result).not.toContain('super-secret-token')
  })
})

describe('structuredLogger', () => {
  it('emits a JSON line with requestId, method, path and status', async () => {
    const captured: string[] = []
    const orig = console.log
    console.log = (msg: string) => captured.push(msg)

    try {
      const app = new Hono()
      app.use('*', structuredLogger())
      app.get('/health', (c) => c.json({ ok: true }))

      await app.request('/health')

      expect(captured).toHaveLength(1)
      const entry = JSON.parse(captured[0]) as Record<string, unknown>
      expect(typeof entry.requestId).toBe('string')
      expect((entry.requestId as string).length).toBe(36)
      expect(entry.method).toBe('GET')
      expect(entry.path).toBe('/health')
      expect(entry.status).toBe(200)
      expect(typeof entry.durationMs).toBe('number')
    } finally {
      console.log = orig
    }
  })

  it('sanitizes webhookSecret in the logged path', async () => {
    const captured: string[] = []
    const orig = console.log
    console.log = (msg: string) => captured.push(msg)

    try {
      const app = new Hono()
      app.use('*', structuredLogger())
      app.post('/api/webhooks/uazapi/:secret', (c) => c.json({ ok: true }))

      await app.request('/api/webhooks/uazapi/my-super-secret', { method: 'POST' })

      const entry = JSON.parse(captured[0]) as Record<string, unknown>
      expect(entry.path).toBe('/api/webhooks/uazapi/[REDACTED]')
      expect(JSON.stringify(entry)).not.toContain('my-super-secret')
    } finally {
      console.log = orig
    }
  })
})

// errorHandler is tested by calling it directly, bypassing Hono's compose dispatch.
// In Hono's normal operation, compose catches route handler errors before middleware
// try-catch runs; calling the middleware function directly lets us test its JSON logging.
describe('errorHandler structured log', () => {
  it('logs JSON with code for ApiError and returns correct status', async () => {
    const captured: string[] = []
    const orig = console.error
    console.error = (msg: string) => captured.push(msg)

    try {
      const handler = errorHandler()
      const c = makeCtx()

      const res = await handler(c as never, async () => {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Bad input')
      })

      expect((res as Response).status).toBe(400)
      expect(captured).toHaveLength(1)
      const entry = JSON.parse(captured[0]) as Record<string, unknown>
      expect(entry.level).toBe('error')
      expect(entry.code).toBe('VALIDATION_ERROR')
    } finally {
      console.error = orig
    }
  })

  it('does not leak raw error message for unexpected errors', async () => {
    const captured: string[] = []
    const orig = console.error
    console.error = (msg: string) => captured.push(msg)

    try {
      const handler = errorHandler()
      const c = makeCtx()

      const res = await handler(c as never, async () => {
        throw new Error('DB password=hunter2 leaked')
      })

      expect((res as Response).status).toBe(500)
      expect(captured).toHaveLength(1)
      expect(captured[0]).not.toContain('hunter2')
      const entry = JSON.parse(captured[0]) as Record<string, unknown>
      expect(entry.level).toBe('error')
      expect(entry.message).toBe('Unexpected error')
    } finally {
      console.error = orig
    }
  })

  it('includes requestId when structuredLogger ran on the same request', async () => {
    const logCapture: string[] = []
    const errCapture: string[] = []
    const origLog = console.log
    const origErr = console.error
    console.log = (msg: string) => logCapture.push(msg)
    console.error = (msg: string) => errCapture.push(msg)

    try {
      const raw = new Request('http://localhost/fail')
      const c = {
        req: { raw, path: '/fail', method: 'GET' },
        // res must exist so structuredLogger can read c.res.status after next()
        res: { status: 200 },
        json: (body: unknown, status: number) => new Response(JSON.stringify(body), { status }),
      }

      // Simulate structuredLogger running first, then errorHandler inside next()
      const loggerMiddleware = structuredLogger()
      await loggerMiddleware(c as never, async () => {
        const errHandler = errorHandler()
        await errHandler(c as never, async () => {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Bad input')
        })
      })

      expect(logCapture).toHaveLength(1)
      expect(errCapture).toHaveLength(1)

      const logEntry = JSON.parse(logCapture[0]) as Record<string, unknown>
      const errEntry = JSON.parse(errCapture[0]) as Record<string, unknown>

      // Both entries must share the same requestId (WeakMap correlation)
      expect(logEntry.requestId).toBeDefined()
      expect(errEntry.requestId).toBe(logEntry.requestId)
    } finally {
      console.log = origLog
      console.error = origErr
    }
  })
})
