const DEFAULT_SECRET = 'test-secret'

function base64url(buf: ArrayBuffer | Buffer): string {
  return Buffer.from(buf).toString('base64url')
}

export async function makeTestJwt({
  userId = crypto.randomUUID(),
  tenantId = crypto.randomUUID(),
  role = 'authenticated',
}: {
  userId?: string
  tenantId?: string
  role?: string
} = {}): Promise<string> {
  const secret = process.env.SUPABASE_JWT_SECRET ?? DEFAULT_SECRET

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      role,
      iss: 'supabase',
      iat: now,
      exp: now + 3600,
      aud: 'authenticated',
      app_metadata: { tenant_id: tenantId },
    }),
  ).toString('base64url')

  const signingInput = `${header}.${payload}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput))

  return `${signingInput}.${base64url(sig)}`
}
