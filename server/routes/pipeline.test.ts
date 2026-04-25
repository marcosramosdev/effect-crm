import { describe, it, expect, beforeAll } from 'bun:test'
import { Hono } from 'hono'
import { makeTestJwt } from '../test/fixtures/jwts'
import { makeSupabaseMock } from '../test/fixtures/supabase'
import { createAuthMiddleware } from '../middlewares/auth'
import { tenantGuard } from '../middlewares/tenant-guard'
import { errorHandler } from '../middlewares/error'
import { createPipelineRouter } from './pipeline'

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const LEAD_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
// Stage IDs must be RFC 4122-compliant (version nibble in [1-8], variant nibble in [89abAB])
const STAGE1_ID = '11111111-1111-4111-8111-111111111111'
const STAGE2_ID = '22222222-2222-4222-8222-222222222222'
const PHONE = '5511999999999'

beforeAll(() => {
  process.env.SUPABASE_JWT_SECRET = 'test-secret'
})

const memberRows = [{ user_id: USER_ID, tenant_id: TENANT_ID, role: 'owner' }]

async function ownerJwt() {
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
}

function makeApp(opts: AppOpts = {}) {
  const authMock = makeSupabaseMock({ rows: memberRows })
  const serviceDb = makeDb(opts.serviceRows ?? {})
  const userDb = makeDb(opts.userRows ?? {})

  const app = new Hono()
  app.use('*', errorHandler())
  app.use('*', createAuthMiddleware(() => authMock as never))
  app.use('*', tenantGuard)

  const router = createPipelineRouter(
    () => userDb.client as never,
    () => serviceDb.client as never,
  )
  app.route('/pipeline', router)

  return { app, serviceDb, userDb }
}

describe('GET /pipeline/stages', () => {
  it('returns list of stages including the default entry', async () => {
    const { app } = makeApp({
      userRows: {
        pipeline_stages: [
          {
            id: STAGE1_ID,
            tenant_id: TENANT_ID,
            name: 'Novo',
            order: 1,
            is_default_entry: true,
            created_at: '2024-01-01T00:00:00.000Z',
          },
          {
            id: STAGE2_ID,
            tenant_id: TENANT_ID,
            name: 'Em conversa',
            order: 2,
            is_default_entry: false,
            created_at: '2024-01-01T00:00:00.000Z',
          },
        ],
      },
    })

    const jwt = await ownerJwt()
    const res = await app.request('/pipeline/stages', {
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      stages: Array<{ id: string; name: string; order: number; isDefaultEntry: boolean }>
    }
    expect(body.stages).toHaveLength(2)
    expect(body.stages.some((s) => s.isDefaultEntry)).toBe(true)
    expect(body.stages.find((s) => s.isDefaultEntry)?.name).toBe('Novo')
  })
})

describe('GET /pipeline/leads', () => {
  it('filters leads by stageId and passes the eq filter to the DB', async () => {
    const { app, userDb } = makeApp({
      userRows: {
        leads: [
          {
            id: LEAD_ID,
            tenant_id: TENANT_ID,
            phone_number: PHONE,
            display_name: 'João',
            stage_id: STAGE1_ID,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
          },
        ],
      },
    })

    const jwt = await ownerJwt()
    const res = await app.request(`/pipeline/leads?stageId=${STAGE1_ID}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      leads: Array<{ id: string; phoneNumber: string; stageId: string }>
      nextCursor: string | null
    }
    expect(body.leads).toHaveLength(1)
    expect(body.leads[0].stageId).toBe(STAGE1_ID)
    expect(body.leads[0].phoneNumber).toBe(PHONE)
    expect(body.nextCursor).toBeNull()

    const selectCall = userDb.calls.find((c) => c.table === 'leads' && c.op === 'select')
    expect(selectCall).toBeDefined()
    expect(selectCall?.filters).toContainEqual({ col: 'stage_id', val: STAGE1_ID, type: 'eq' })
  })
})

describe('PATCH /pipeline/leads/:id/stage', () => {
  // T-S-065
  it('updates lead stage_id and inserts stage_transition with moved_by_user_id', async () => {
    const { app, serviceDb } = makeApp({
      serviceRows: {
        leads: [
          {
            id: LEAD_ID,
            tenant_id: TENANT_ID,
            phone_number: PHONE,
            display_name: null,
            stage_id: STAGE1_ID,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
          },
        ],
      },
    })

    const jwt = await ownerJwt()
    const res = await app.request(`/pipeline/leads/${LEAD_ID}/stage`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stageId: STAGE2_ID }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { lead: { id: string; stageId: string } }
    expect(body.lead.id).toBe(LEAD_ID)
    expect(body.lead.stageId).toBe(STAGE2_ID)

    const updateOp = serviceDb.calls.find((c) => c.table === 'leads' && c.op === 'update')
    expect(updateOp).toBeDefined()
    expect(updateOp?.data).toMatchObject({ stage_id: STAGE2_ID })

    const insertOp = serviceDb.calls.find(
      (c) => c.table === 'stage_transitions' && c.op === 'insert',
    )
    expect(insertOp).toBeDefined()
    expect(insertOp?.data).toMatchObject({
      tenant_id: TENANT_ID,
      lead_id: LEAD_ID,
      from_stage_id: STAGE1_ID,
      to_stage_id: STAGE2_ID,
      moved_by_user_id: USER_ID,
    })
  })

  it('returns 404 when lead does not exist or belongs to another tenant', async () => {
    const { app } = makeApp({
      serviceRows: { leads: [] },
    })

    const jwt = await ownerJwt()
    const res = await app.request(`/pipeline/leads/${LEAD_ID}/stage`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ stageId: STAGE2_ID }),
    })

    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('NOT_FOUND')
  })
})
