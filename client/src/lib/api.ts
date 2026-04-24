import { supabase } from './supabase'

export class RateLimitedError extends Error {
  retryAfter: number | undefined
  constructor(retryAfter?: number) {
    super('Rate limited')
    this.name = 'RateLimitedError'
    this.retryAfter = retryAfter
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
  schema?: { parse: (data: unknown) => T },
): Promise<T> {
  let token: string | undefined
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    token = session?.access_token ?? undefined
  } catch {
    // no session available — proceed without Authorization header
  }

  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`/api${path}`, { ...init, headers })

  if (res.status === 401) {
    await supabase.auth.signOut()
    throw new Error('Unauthorized')
  }

  if (res.status === 429) {
    const after = res.headers.get('Retry-After')
    throw new RateLimitedError(after ? Number(after) : undefined)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw Object.assign(
      new Error((body as { message?: string }).message ?? res.statusText),
      { status: res.status },
    )
  }

  const json: unknown = await res.json()
  return schema ? schema.parse(json) : (json as T)
}
