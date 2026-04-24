import { describe, it, expect, beforeEach } from 'bun:test'
import { handleWebhookEvent } from './webhook-handler'
import { inboundTextMessage, inboundUnsupportedMessage } from './__fixtures__/uazapi-events'

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

interface UpdateCall {
  table: string
  data: Record<string, unknown>
  eq: { col: string; val: unknown }
}

let updateCalls: UpdateCall[]

function makeTestClient() {
  return {
    from: (table: string) => ({
      update: (data: Record<string, unknown>) => ({
        eq: (col: string, val: unknown) => {
          updateCalls.push({ table, data, eq: { col, val } })
          return Promise.resolve({ data: null, error: null })
        },
      }),
    }),
  }
}

beforeEach(() => {
  updateCalls = []
})

describe('handleWebhookEvent — connection', () => {
  // T-S-027
  it('updates status and last_heartbeat_at for state=connected', async () => {
    await handleWebhookEvent(
      TENANT_ID,
      { event: 'connection', instance: 'inst-001', data: { state: 'connected', phoneNumber: '5511999999999' } },
      () => makeTestClient() as never,
    )

    expect(updateCalls).toHaveLength(1)
    const { table, data, eq } = updateCalls[0]
    expect(table).toBe('whatsapp_sessions')
    expect(data.status).toBe('connected')
    expect(data.phone_number).toBe('5511999999999')
    expect(typeof data.last_heartbeat_at).toBe('string')
    expect(data.last_error).toBeUndefined()
    expect(eq.col).toBe('tenant_id')
    expect(eq.val).toBe(TENANT_ID)
  })

  it('sets last_error and does not set last_heartbeat_at for state=disconnected', async () => {
    await handleWebhookEvent(
      TENANT_ID,
      { event: 'connection', instance: 'inst-001', data: { state: 'disconnected', reason: 'connection lost' } },
      () => makeTestClient() as never,
    )

    expect(updateCalls).toHaveLength(1)
    const { data } = updateCalls[0]
    expect(data.status).toBe('disconnected')
    expect(data.last_error).toBe('connection lost')
    expect(data.last_heartbeat_at).toBeUndefined()
  })

  it('ignores unknown events without throwing', async () => {
    await handleWebhookEvent(
      TENANT_ID,
      { event: 'messages', instance: 'inst-001', data: {} },
      () => makeTestClient() as never,
    )
    expect(updateCalls).toHaveLength(0)
  })
})

// ── T-S-020..023 ─────────────────────────────────────────────────────────────

const STAGE_ID = 'stage-id-1111-1111-1111-111111111111'
const LEAD_ID = 'lead-id-2222-2222-2222-222222222222'
const CONV_ID = 'conv-id-3333-3333-3333-333333333333'

interface DbOp {
  table: string
  op: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
}

function makeMessagesTestClient() {
  const ops: DbOp[] = []
  const tableRows: Record<string, Record<string, unknown> | null> = {
    pipeline_stages: { id: STAGE_ID },
    leads: { id: LEAD_ID },
    conversations: { id: CONV_ID },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function chain(table: string): any {
    return {
      select: () => chain(table),
      eq: () => chain(table),
      upsert: (data: unknown) => {
        ops.push({ table, op: 'upsert', data })
        return chain(table)
      },
      insert: (data: unknown) => {
        ops.push({ table, op: 'insert', data })
        return chain(table)
      },
      update: (data: unknown) => {
        ops.push({ table, op: 'update', data })
        return chain(table)
      },
      single: () => Promise.resolve({ data: tableRows[table] ?? null, error: null }),
      maybeSingle: () => Promise.resolve({ data: tableRows[table] ?? null, error: null }),
      then: <R>(ok: (v: { data: unknown; error: null }) => R, rej?: (e: unknown) => R) =>
        Promise.resolve({ data: tableRows[table] ?? null, error: null }).then(ok, rej),
    }
  }

  return { ops, client: { from: (table: string) => chain(table) } }
}

describe('handleWebhookEvent — messages', () => {
  // T-S-020
  it('creates lead, conversation and inbound message for a text payload', async () => {
    const { ops, client } = makeMessagesTestClient()

    await handleWebhookEvent(TENANT_ID, inboundTextMessage, () => client as never)

    const upsertLead = ops.find(o => o.table === 'leads' && o.op === 'upsert')
    expect(upsertLead).toBeDefined()
    expect(upsertLead!.data).toMatchObject({
      tenant_id: TENANT_ID,
      phone_number: '5511999999999',
    })

    const upsertConv = ops.find(o => o.table === 'conversations' && o.op === 'upsert')
    expect(upsertConv).toBeDefined()
    expect(upsertConv!.data).toMatchObject({
      tenant_id: TENANT_ID,
      lead_id: LEAD_ID,
    })

    const insertMsg = ops.find(o => o.table === 'messages' && o.op === 'insert')
    expect(insertMsg).toBeDefined()
    expect(insertMsg!.data).toMatchObject({
      tenant_id: TENANT_ID,
      conversation_id: CONV_ID,
      direction: 'inbound',
      content_type: 'text',
      text: inboundTextMessage.data.text,
      whatsapp_message_id: inboundTextMessage.data.id,
    })
  })

  // T-S-021
  it('does not throw on duplicate whatsapp_message_id — both calls attempt insert (ON CONFLICT handled by DB)', async () => {
    const { ops, client } = makeMessagesTestClient()

    await handleWebhookEvent(TENANT_ID, inboundTextMessage, () => client as never)
    await handleWebhookEvent(TENANT_ID, inboundTextMessage, () => client as never)

    const insertOps = ops.filter(o => o.table === 'messages' && o.op === 'insert')
    expect(insertOps).toHaveLength(2)
  })

  // T-S-022
  it('inserts content_type=unsupported and text=null for non-text messageType', async () => {
    const { ops, client } = makeMessagesTestClient()

    await handleWebhookEvent(TENANT_ID, inboundUnsupportedMessage, () => client as never)

    const insertMsg = ops.find(o => o.table === 'messages' && o.op === 'insert')
    expect(insertMsg).toBeDefined()
    expect(insertMsg!.data).toMatchObject({
      content_type: 'unsupported',
      text: null,
    })
  })

  // T-S-023
  it('ignores group messages (chatid ending with @g.us) without any DB calls', async () => {
    const { ops, client } = makeMessagesTestClient()

    const groupMessage = {
      event: 'messages' as const,
      instance: 'inst-test-001',
      data: {
        id: 'group-msg-001',
        chatid: '120363000000000000@g.us',
        fromMe: false,
        messageType: 'conversation',
        text: 'hello group',
        pushName: 'Test User',
        timestamp: 1700000000,
      },
    }

    await handleWebhookEvent(TENANT_ID, groupMessage, () => client as never)

    expect(ops).toHaveLength(0)
  })
})
