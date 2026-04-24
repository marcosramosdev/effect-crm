import { describe, it, expect, beforeEach } from 'bun:test'
import { handleWebhookEvent } from './webhook-handler'

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
