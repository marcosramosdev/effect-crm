const TEST_SECRET = 'test-secret'

function base64url(buf: ArrayBuffer | Buffer): string {
  return Buffer.from(buf).toString('base64url')
}

async function makeHmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function makeTestJwt({
  userId = crypto.randomUUID(),
  tenantId = crypto.randomUUID(),
  role = 'authenticated',
  email = 'test@example.com',
}: {
  userId?: string
  tenantId?: string
  role?: string
  email?: string
} = {}): Promise<string> {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      email,
      role,
      iss: 'supabase',
      iat: now,
      exp: now + 3600,
      aud: 'authenticated',
      app_metadata: { tenant_id: tenantId },
    }),
  ).toString('base64url')

  const signingInput = `${header}.${payload}`
  const key = await makeHmacKey(TEST_SECRET)
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput))

  return `${signingInput}.${base64url(sig)}`
}

export async function verifyTestJwt(token: string): Promise<{ id: string; email: string } | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, p, sigB64] = parts
  try {
    const key = await makeHmacKey(TEST_SECRET)
    const sigBytes = Buffer.from(sigB64, 'base64url')
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(`${h}.${p}`),
    )
    if (!valid) return null
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString()) as Record<string, unknown>
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null
    return { id: payload.sub as string, email: (payload.email as string | undefined) ?? '' }
  } catch {
    return null
  }
}
