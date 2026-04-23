const MINUTE_CAPACITY = 20
const MINUTE_WINDOW_MS = 60_000
const DAILY_CAPACITY = 1000
const DAILY_WINDOW_MS = 24 * 60 * 60_000

const MINUTE_RATE = MINUTE_CAPACITY / MINUTE_WINDOW_MS // tokens per ms
const DAILY_RATE = DAILY_CAPACITY / DAILY_WINDOW_MS // tokens per ms

interface Bucket {
  minuteTokens: number
  minuteLastRefill: number
  dailyTokens: number
  dailyLastRefill: number
}

const buckets = new Map<string, Bucket>()

function getOrCreateBucket(tenantId: string, now: number): Bucket {
  if (!buckets.has(tenantId)) {
    buckets.set(tenantId, {
      minuteTokens: MINUTE_CAPACITY,
      minuteLastRefill: now,
      dailyTokens: DAILY_CAPACITY,
      dailyLastRefill: now,
    })
  }
  return buckets.get(tenantId)!
}

function refill(bucket: Bucket, now: number): void {
  const minuteElapsed = now - bucket.minuteLastRefill
  if (minuteElapsed > 0) {
    bucket.minuteTokens = Math.min(MINUTE_CAPACITY, bucket.minuteTokens + minuteElapsed * MINUTE_RATE)
    bucket.minuteLastRefill = now
  }

  const dailyElapsed = now - bucket.dailyLastRefill
  if (dailyElapsed > 0) {
    bucket.dailyTokens = Math.min(DAILY_CAPACITY, bucket.dailyTokens + dailyElapsed * DAILY_RATE)
    bucket.dailyLastRefill = now
  }
}

export function consume(tenantId: string): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now()
  const bucket = getOrCreateBucket(tenantId, now)
  refill(bucket, now)

  if (bucket.dailyTokens < 1) {
    const msUntilToken = (1 - bucket.dailyTokens) / DAILY_RATE
    return { ok: false, retryAfterSeconds: Math.ceil(msUntilToken / 1000) }
  }

  if (bucket.minuteTokens < 1) {
    const msUntilToken = (1 - bucket.minuteTokens) / MINUTE_RATE
    return { ok: false, retryAfterSeconds: Math.ceil(msUntilToken / 1000) }
  }

  bucket.minuteTokens -= 1
  bucket.dailyTokens -= 1
  return { ok: true }
}

export function _resetBuckets(): void {
  buckets.clear()
}

export function _setBucketForTesting(tenantId: string, state: Partial<Bucket>): void {
  const now = Date.now()
  const existing: Bucket = buckets.get(tenantId) ?? {
    minuteTokens: MINUTE_CAPACITY,
    minuteLastRefill: now,
    dailyTokens: DAILY_CAPACITY,
    dailyLastRefill: now,
  }
  buckets.set(tenantId, { ...existing, ...state })
}
