import { describe, it, expect, beforeAll } from 'bun:test'
import { Hono } from 'hono'
import { makeTestJwt } from '../test/fixtures/jwts'
import { makeSupabaseMock } from '../test/fixtures/supabase'
import { createAuthMiddleware } from '../middlewares/auth'
import { tenantGuard } from '../middlewares/tenant-guard'
import { errorHandler } from '../middlewares/error'
import { createTeamRouter } from './team'

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const OWNER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const AGENT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const NEW_USER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

beforeAll(() => {
  process.env.SUPABASE_JWT_SECRET = 'test-secret'
})

interface TrackedCall {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete'
  data?: unknown
  filters: Array<{ col: string; val: unknown }>
}

interface InviteCall {
  email: string
  opts?: unknown
}

type RowsByTable = Record<string, Record<string, unknown>[]>

function makeDb(rowsByTable: RowsByTable = {}) {
  const calls: TrackedCall[] = []

  function makeFrom(table: string) {
    const filters: TrackedCall['filters'] = []
    let pending: TrackedCall | null = null

    const finalize = () => {
      if (pending) { calls.push(pending); pending = null }
      return rowsByTable[table] ?? []
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select: () => { if (!pending) pending = { table, op: 'select', filters }; return chain },
      insert: (data: unknown) => { pending = { table, op: 'insert', data, filters }; return chain },
      update: (data: unknown) => { pending = { table, op: 'update', data, filters }; return chain },
      delete: () => { pending = { table, op: 'delete', filters }; return chain },
      eq: (col: string, val: unknown) => { filters.push({ col, val }); return chain },
      order: () => chain,
      limit: () => chain,
      single: () => { const rows = finalize(); return Promise.resolve({ data: rows[0] ?? null, error: null }) },
      maybeSingle: () => { const rows = finalize(); return Promise.resolve({ data: rows[0] ?? null, error: null }) },
      then: <R>(ok: (v: { data: unknown; error: null }) => R, rej?: (e: unknown) => R) => {
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
  role?: 'owner' | 'agent'
  inviteResponse?: { data: { user: { id: string; email: string } } | null; error: { message: string } | null }
}

function makeApp(opts: AppOpts = {}) {
  const role = opts.role ?? 'owner'
  const currentMemberRows = [{ user_id: OWNER_ID, tenant_id: TENANT_ID, role }]
  const authMock = makeSupabaseMock({ rows: currentMemberRows })

  const db = makeDb(opts.serviceRows ?? {})
  const inviteCalls: InviteCall[] = []
  const inviteResponse = opts.inviteResponse ?? {
    data: { user: { id: NEW_USER_ID, email: 'new@example.com' } },
    error: null,
  }

  const serviceClient = {
    from: db.client.from,
    auth: {
      admin: {
        inviteUserByEmail: (email: string, inviteOpts?: unknown) => {
          inviteCalls.push({ email, opts: inviteOpts })
          return Promise.resolve(inviteResponse)
        },
      },
    },
  }

  const app = new Hono()
  app.use('*', errorHandler())
  app.use('*', createAuthMiddleware(() => authMock as never))
  app.use('*', tenantGuard)

  const router = createTeamRouter(() => serviceClient as never)
  app.route('/team', router)

  return { app, db, inviteCalls }
}

describe('GET /team', () => {
  it('returns member list for owner', async () => {
    const { app } = makeApp({
      serviceRows: {
        tenant_members: [
          { user_id: OWNER_ID, tenant_id: TENANT_ID, role: 'owner', created_at: '2024-01-01T00:00:00.000Z' },
          { user_id: AGENT_ID, tenant_id: TENANT_ID, role: 'agent', created_at: '2024-01-02T00:00:00.000Z' },
        ],
      },
    })
    const jwt = await makeTestJwt({ userId: OWNER_ID, tenantId: TENANT_ID })
    const res = await app.request('/team', { headers: { Authorization: `Bearer ${jwt}` } })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { members: Array<{ userId: string; role: string }> }
    expect(body.members).toHaveLength(2)
    expect(body.members.some((m) => m.role === 'owner')).toBe(true)
  })

  it('returns 403 for agent', async () => {
    const { app } = makeApp({ role: 'agent' })
    const jwt = await makeTestJwt({ userId: AGENT_ID, tenantId: TENANT_ID })
    const res = await app.request('/team', { headers: { Authorization: `Bearer ${jwt}` } })
    expect(res.status).toBe(403)
  })
})

describe('POST /team/invite', () => {
  it('invites user as owner: calls inviteUserByEmail and inserts into tenant_members', async () => {
    const { app, db, inviteCalls } = makeApp()
    const jwt = await makeTestJwt({ userId: OWNER_ID, tenantId: TENANT_ID })

    const res = await app.request('/team/invite', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com', role: 'agent' }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { member: { userId: string; email: string; role: string } }
    expect(body.member.userId).toBe(NEW_USER_ID)
    expect(body.member.role).toBe('agent')

    expect(inviteCalls).toHaveLength(1)
    expect(inviteCalls[0].email).toBe('new@example.com')

    const insertOp = db.calls.find((c) => c.table === 'tenant_members' && c.op === 'insert')
    expect(insertOp).toBeDefined()
    expect(insertOp?.data).toMatchObject({ user_id: NEW_USER_ID, role: 'agent' })
  })

  it('returns 403 when called as agent', async () => {
    const { app, inviteCalls } = makeApp({ role: 'agent' })
    const jwt = await makeTestJwt({ userId: AGENT_ID, tenantId: TENANT_ID })

    const res = await app.request('/team/invite', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com' }),
    })

    expect(res.status).toBe(403)
    expect(inviteCalls).toHaveLength(0)
  })
})

describe('DELETE /team/:userId', () => {
  it('removes agent member and returns 204', async () => {
    const { app, db } = makeApp({
      serviceRows: {
        tenant_members: [
          { user_id: OWNER_ID, tenant_id: TENANT_ID, role: 'owner' },
          { user_id: AGENT_ID, tenant_id: TENANT_ID, role: 'agent' },
        ],
      },
    })
    const jwt = await makeTestJwt({ userId: OWNER_ID, tenantId: TENANT_ID })

    const res = await app.request(`/team/${AGENT_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(204)
    const deleteOp = db.calls.find((c) => c.table === 'tenant_members' && c.op === 'delete')
    expect(deleteOp).toBeDefined()
  })

  it('returns 409 when trying to remove the only owner', async () => {
    const { app } = makeApp({
      serviceRows: {
        tenant_members: [{ user_id: OWNER_ID, tenant_id: TENANT_ID, role: 'owner' }],
      },
    })
    const jwt = await makeTestJwt({ userId: OWNER_ID, tenantId: TENANT_ID })

    const res = await app.request(`/team/${OWNER_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('LAST_OWNER')
  })

  it('returns 403 for agent', async () => {
    const { app } = makeApp({ role: 'agent' })
    const jwt = await makeTestJwt({ userId: AGENT_ID, tenantId: TENANT_ID })
    const res = await app.request(`/team/${OWNER_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}` },
    })
    expect(res.status).toBe(403)
  })
})
