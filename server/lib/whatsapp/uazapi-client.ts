export class UazapiUnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UazapiUnauthorizedError'
  }
}

export class UazapiRateLimitedError extends Error {
  retryAfter: number | undefined
  constructor(retryAfter?: number) {
    super('Rate limited by uazapi')
    this.name = 'UazapiRateLimitedError'
    this.retryAfter = retryAfter
  }
}

export class UazapiNotFoundError extends Error {
  constructor(message = 'Resource not found on uazapi') {
    super(message)
    this.name = 'UazapiNotFoundError'
  }
}

export class UazapiTransientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UazapiTransientError'
  }
}

function baseUrl(): string {
  return process.env.UAZAPI_BASE_URL ?? 'https://free.uazapi.com'
}

function adminToken(): string {
  return process.env.UAZAPI_ADMIN_TOKEN ?? ''
}

async function checkResponse(res: Response): Promise<unknown> {
  if (res.status === 401) throw new UazapiUnauthorizedError()
  if (res.status === 404) throw new UazapiNotFoundError()
  if (res.status === 429) {
    const header = res.headers.get('Retry-After')
    throw new UazapiRateLimitedError(header ? parseInt(header, 10) : undefined)
  }
  if (res.status >= 500) throw new UazapiTransientError(`uazapi server error: ${res.status}`)
  return res.json()
}

export type UazapiInstanceStatus = {
  status: string
  connected: boolean
  loggedIn: boolean
  phoneNumber: string | null
  instanceName: string | null
  qr: string | null
}

function normalizePhoneNumber(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  return value.includes('@') ? value.split('@')[0] ?? null : value
}

function extractPhoneNumber(data: Record<string, unknown>): string | null {
  const instance = data.instance as Record<string, unknown> | undefined
  const ownerFromInstance = normalizePhoneNumber(instance?.owner)
  if (ownerFromInstance) return ownerFromInstance

  const jidFromInstance = instance?.jid as Record<string, unknown> | undefined
  const userFromInstanceJid = normalizePhoneNumber(jidFromInstance?.user)
  if (userFromInstanceJid) return userFromInstanceJid

  const jid = data.jid as Record<string, unknown> | undefined
  return normalizePhoneNumber(jid?.user)
}

export async function createInstance(params: {
  name: string
  adminField01?: string
}): Promise<{ instanceId: string; token: string }> {
  const res = await fetch(`${baseUrl()}/instance/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', admintoken: adminToken() },
    body: JSON.stringify(params),
  })
  const data = (await checkResponse(res)) as { instanceId?: string; id?: string; instance?: { id?: string }; token: string }
  console.log('[uazapi] createInstance raw response:', JSON.stringify(data))
  return { instanceId: data.instanceId ?? data.id ?? data.instance?.id ?? data.token, token: data.token }
}

export async function connect(instanceToken: string): Promise<{ qr: string | null; status: string }> {
  const res = await fetch(`${baseUrl()}/instance/connect`, {
    method: 'POST',
    headers: { token: instanceToken },
  })
  const data = (await checkResponse(res)) as { qrcode?: string; status?: string }
  console.log('[uazapi] connect raw response:', JSON.stringify(data))
  return { qr: data.qrcode || null, status: data.status ?? 'connecting' }
}

export async function disconnect(instanceToken: string): Promise<void> {
  const res = await fetch(`${baseUrl()}/instance/disconnect`, {
    method: 'POST',
    headers: { token: instanceToken },
  })
  await checkResponse(res)
}

export async function deleteInstance(token: string): Promise<void> {
  const res = await fetch(`${baseUrl()}/instance`, {
    method: 'DELETE',
    headers: { token },
  })
  if (res.status === 404) return
  await checkResponse(res)
}

export async function getInstanceStatus(token: string): Promise<UazapiInstanceStatus> {
  const res = await fetch(`${baseUrl()}/instance/status`, {
    method: 'GET',
    headers: { token },
  })
  const data = (await checkResponse(res)) as Record<string, unknown>
  const instance = data.instance as Record<string, unknown> | undefined
  const connected = Boolean(data.connected)
  const loggedIn = Boolean(data.loggedIn)
  const statusValue = typeof data.status === 'string' && data.status.length > 0 ? data.status : null

  const qrRaw = typeof data.qrcode === 'string' ? data.qrcode : (typeof instance?.qrcode === 'string' ? instance.qrcode : null)

  return {
    status: statusValue ?? (connected ? 'connected' : 'disconnected'),
    connected,
    loggedIn,
    phoneNumber: extractPhoneNumber(data),
    instanceName:
      (typeof data.instanceName === 'string' ? data.instanceName : undefined) ??
      (typeof instance?.name === 'string' ? instance.name : null),
    qr: qrRaw || null,
  }
}

export async function sendText(params: {
  token: string
  number: string
  text: string
}): Promise<{ messageId: string }> {
  const { token, number, text } = params
  const res = await fetch(`${baseUrl()}/send/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token },
    body: JSON.stringify({ number, text }),
  })
  const data = (await checkResponse(res)) as { id?: string }
  return { messageId: data.id ?? '' }
}

export async function configureWebhook(params: {
  token: string
  url: string
  events: string[]
  excludeMessages?: string[]
}): Promise<void> {
  const { token, url, events, excludeMessages } = params
  const res = await fetch(`${baseUrl()}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token },
    body: JSON.stringify({ enabled: true, url, events, excludeMessages }),
  })
  await checkResponse(res)
}
