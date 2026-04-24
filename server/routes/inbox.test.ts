import { describe, it, expect, beforeAll } from 'bun:test'
import { Hono } from 'hono'
import { makeTestJwt } from '../test/fixtures/jwts'
import { makeSupabaseMock } from '../test/fixtures/supabase'
import { createAuthMiddleware } from '../middlewares/auth'
import { tenantGuard } from '../middlewares/tenant-guard'
import { errorHandler } from '../middlewares/error'
import { createInboxRouter } from './inbox'

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const CONV_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const PHONE = '5511999999999'

beforeAll(() => {
  process.env.SUPABASE_JWT_SECRET = 'test-secret'
})

const memberRows = [{ user_id: USER_ID, tenant_id: TENANT_ID, role: 'agent' }]

async function userJwt() {
  return makeTestJwt({ userId: USER_ID, tenantId: TENANT_ID })
}

interface TrackedCall {
  table: string
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete'
  data?: unknown
  filters: Array<{ col: string; val: unknown; type: string }>
}

type RowsByTable = Record<string, Record<string, unknown>[]>

function makeDb(rowsByTable: RowsByTable = {}) {
  const calls: TrackedCall[] = []

  function makeFrom(table: string) {
    const filters: TrackedCall['filters'] = []
    let pending: TrackedCall | null = null

    const finalize = () => {
      if (pending) {
        calls.push(pending)
        pending = null
      }
      return rowsByTable[table] ?? []
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select: () => {
        if (!pending) pending = { table, op: 'select', filters }
        return chain
      },
      insert: (data: unknown) => {
        pending = { table, op: 'insert', data, filters }
        return chain
      },
      update: (data: unknown) => {
        pending = { table, op: 'update', data, filters }
        return chain
      },
      upsert: (data: unknown) => {
        pending = { table, op: 'upsert', data, filters }
        return chain
      },
      delete: () => {
        pending = { table, op: 'delete', filters }
        return chain
      },
      eq: (col: string, val: unknown) => {
        filters.push({ col, val, type: 'eq' })
        return chain
      },
      neq: (col: string, val: unknown) => {
        filters.push({ col, val, type: 'neq' })
        return chain
      },
      lt: (col: string, val: unknown) => {
        filters.push({ col, val, type: 'lt' })
        return chain
      },
      gt: (col: string, val: unknown) => {
        filters.push({ col, val, type: 'gt' })
        return chain
      },
      is: (col: string, val: unknown) => {
        filters.push({ col, val, type: 'is' })
        return chain
      },
      in: (col: string, val: unknown) => {
        filters.push({ col, val, type: 'in' })
        return chain
      },
      or: (expr: string) => {
        filters.push({ col: '__or__', val: expr, type: 'or' })
        return chain
      },
      order: () => chain,
      limit: () => chain,
      single: () => {
        const rows = finalize()
        return Promise.resolve({ data: rows[0] ?? null, error: null })
      },
      maybeSingle: () => {
        const rows = finalize()
        return Promise.resolve({ data: rows[0] ?? null, error: null })
      },
      then: <R>(
        ok: (v: { data: unknown; error: null }) => R,
        rej?: (e: unknown) => R,
      ) => {
        const rows = finalize()
        return Promise.resolve({ data: rows, error: null }).then(ok, rej)
      },
    }
    return chain
  }

  return { calls, client: { from: makeFrom } }
}

interface AppOpts {
  serviceRows?: RowsByTable
  userRows?: RowsByTable
  consume: () => { ok: true } | { ok: false; retryAfterSeconds: number }
  sendText?: (params: {
    token: string
    number: string
    text: string
  }) => Promise<{ messageId: string }>
}

function makeApp(opts: AppOpts) {
  const authMock = makeSupabaseMock({ rows: memberRows })
  const serviceDb = makeDb(opts.serviceRows ?? {})
  const userDb = makeDb(opts.userRows ?? {})

  const sendTextSpy = {
    calls: [] as Array<{ token: string; number: string; text: string }>,
    impl: opts.sendText ?? (async () => ({ messageId: 'wa-msg-default' })),
  }
  async function sendTextWrapper(params: {
    token: string
    number: string
    text: string
  }) {
    sendTextSpy.calls.push(params)
    return sendTextSpy.impl(params)
  }

  const app = new Hono()
  app.use('*', errorHandler())
  app.use('*', createAuthMiddleware(() => authMock as never))
  app.use('*', tenantGuard)

  const router = createInboxRouter(
    () => userDb.client as never,
    () => serviceDb.client as never,
    { sendText: sendTextWrapper as never, consume: opts.consume },
  )
  app.route('/inbox', router)

  return { app, serviceDb, userDb, sendTextSpy }
}

describe('POST /inbox/conversations/:id/messages', () => {
  // T-S-050
  it('returns 409 WHATSAPP_DISCONNECTED when session is not connected', async () => {
    const { app, sendTextSpy } = makeApp({
      serviceRows: {
        whatsapp_sessions: [{ status: 'disconnected', uazapi_instance_token: null }],
      },
      userRows: { conversations: [{ id: CONV_ID, leads: { phone_number: PHONE } }] },
      consume: () => ({ ok: true }),
    })

    const jwt = await userJwt()
    const res = await app.request(`/inbox/conversations/${CONV_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'olá' }),
    })

    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('WHATSAPP_DISCONNECTED')
    expect(sendTextSpy.calls).toHaveLength(0)
  })

  // T-S-051
  it('returns 429 with Retry-After header when rate limit exceeded (no DB calls)', async () => {
    const { app, serviceDb, userDb, sendTextSpy } = makeApp({
      consume: () => ({ ok: false, retryAfterSeconds: 30 }),
    })

    const jwt = await userJwt()
    const res = await app.request(`/inbox/conversations/${CONV_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'olá' }),
    })

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('RATE_LIMITED')
    expect(serviceDb.calls).toHaveLength(0)
    expect(userDb.calls).toHaveLength(0)
    expect(sendTextSpy.calls).toHaveLength(0)
  })

  // T-S-052
  it('returns 202, dispatches uazapi.sendText and inserts pending message on happy path', async () => {
    const { app, serviceDb, sendTextSpy } = makeApp({
      serviceRows: {
        whatsapp_sessions: [
          { status: 'connected', uazapi_instance_token: 'tok-001' },
        ],
      },
      userRows: { conversations: [{ id: CONV_ID, leads: { phone_number: PHONE } }] },
      consume: () => ({ ok: true }),
      sendText: async () => ({ messageId: 'wa-msg-001' }),
    })

    const jwt = await userJwt()
    const res = await app.request(`/inbox/conversations/${CONV_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'olá teste' }),
    })

    expect(res.status).toBe(202)
    const body = (await res.json()) as { message: Record<string, unknown> }
    expect(body.message.status).toBe('pending')
    expect(body.message.direction).toBe('outbound')
    expect(body.message.contentType).toBe('text')
    expect(body.message.text).toBe('olá teste')
    expect(body.message.sentByUserId).toBe(USER_ID)
    expect(body.message.conversationId).toBe(CONV_ID)
    expect(typeof body.message.id).toBe('string')
    expect(typeof body.message.createdAt).toBe('string')

    expect(sendTextSpy.calls).toHaveLength(1)
    expect(sendTextSpy.calls[0]).toMatchObject({
      token: 'tok-001',
      number: PHONE,
      text: 'olá teste',
    })

    const insertOp = serviceDb.calls.find(
      (c) => c.table === 'messages' && c.op === 'insert',
    )
    expect(insertOp).toBeDefined()
    expect(insertOp!.data).toMatchObject({
      tenant_id: TENANT_ID,
      conversation_id: CONV_ID,
      direction: 'outbound',
      content_type: 'text',
      text: 'olá teste',
      status: 'pending',
      sent_by_user_id: USER_ID,
    })

    const updateOp = serviceDb.calls.find(
      (c) => c.table === 'messages' && c.op === 'update',
    )
    expect(updateOp).toBeDefined()
    expect(updateOp!.data).toMatchObject({ whatsapp_message_id: 'wa-msg-001' })
  })

  // T-S-053
  it('returns 404 for conversation belonging to another tenant (RLS returns null)', async () => {
    const { app, serviceDb, sendTextSpy } = makeApp({
      serviceRows: {
        whatsapp_sessions: [
          { status: 'connected', uazapi_instance_token: 'tok-001' },
        ],
      },
      userRows: { conversations: [] },
      consume: () => ({ ok: true }),
    })

    const jwt = await userJwt()
    const res = await app.request(`/inbox/conversations/${CONV_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'olá' }),
    })

    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('NOT_FOUND')
    expect(sendTextSpy.calls).toHaveLength(0)
    expect(
      serviceDb.calls.find((c) => c.table === 'messages' && c.op === 'insert'),
    ).toBeUndefined()
  })
})
