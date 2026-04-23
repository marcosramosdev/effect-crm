import { describe, it, expect, beforeEach, afterEach, setSystemTime } from 'bun:test'
import { consume, _resetBuckets, _setBucketForTesting } from './rate-limiter'

const NOW = new Date('2024-01-01T00:00:00.000Z').getTime()

describe('rate-limiter', () => {
  beforeEach(() => {
    setSystemTime(new Date(NOW))
    _resetBuckets()
  })

  afterEach(() => {
    setSystemTime() // reset to real time
  })

  // T-S-001
  it('emite tokens até ao limite configurado (20/min)', () => {
    const tenantId = 'tenant-001'
    for (let i = 0; i < 20; i++) {
      expect(consume(tenantId)).toEqual({ ok: true })
    }
    const result = consume(tenantId)
    expect(result.ok).toBe(false)
  })

  // T-S-002
  it('tokens refrescam à taxa esperada (~1 a cada 3s)', () => {
    const tenantId = 'tenant-002'
    for (let i = 0; i < 20; i++) consume(tenantId)
    expect(consume(tenantId).ok).toBe(false)

    // Advance 3 seconds — should unlock exactly 1 new token
    setSystemTime(new Date(NOW + 3_000))
    expect(consume(tenantId)).toEqual({ ok: true })
    expect(consume(tenantId).ok).toBe(false)
  })

  // T-S-003
  it('buckets de tenants diferentes são independentes', () => {
    const tenant1 = 'tenant-003a'
    const tenant2 = 'tenant-003b'
    for (let i = 0; i < 20; i++) consume(tenant1)
    expect(consume(tenant1).ok).toBe(false)
    expect(consume(tenant2)).toEqual({ ok: true })
  })

  // T-S-004
  it('limite diário corta mesmo quando por-minuto tem tokens', () => {
    const tenantId = 'tenant-004'
    // Directly set state: daily exhausted, per-minute full
    _setBucketForTesting(tenantId, {
      minuteTokens: 20,
      minuteLastRefill: NOW,
      dailyTokens: 0,
      dailyLastRefill: NOW,
    })
    const result = consume(tenantId)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      // Daily limit → much longer retry than per-minute's ~3s
      expect(result.retryAfterSeconds).toBeGreaterThan(3)
    }
  })

  // T-S-005
  it('retryAfterSeconds corresponde ao próximo refresh do per-minute', () => {
    const tenantId = 'tenant-005'
    for (let i = 0; i < 20; i++) consume(tenantId)
    const result = consume(tenantId)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      // 20/min = 1 token per 3s → retry should be ≤ 3s
      expect(result.retryAfterSeconds).toBeGreaterThan(0)
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(3)
    }
  })
})
