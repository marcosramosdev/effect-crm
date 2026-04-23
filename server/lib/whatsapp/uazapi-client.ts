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
  if (res.status === 429) {
    const header = res.headers.get('Retry-After')
    throw new UazapiRateLimitedError(header ? parseInt(header, 10) : undefined)
  }
  if (res.status >= 500) throw new UazapiTransientError(`uazapi server error: ${res.status}`)
  return res.json()
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
  const data = (await checkResponse(res)) as { id: string; token: string }
  return { instanceId: data.id, token: data.token }
}

export async function connect(instanceToken: string): Promise<{ qr: string | null; status: string }> {
  const res = await fetch(`${baseUrl()}/instance/connect`, {
    method: 'POST',
    headers: { token: instanceToken },
  })
  const data = (await checkResponse(res)) as { qrcode?: string; status?: string }
  return { qr: data.qrcode ?? null, status: data.status ?? 'connecting' }
}

export async function disconnect(instanceToken: string): Promise<void> {
  const res = await fetch(`${baseUrl()}/instance/disconnect`, {
    method: 'POST',
    headers: { token: instanceToken },
  })
  await checkResponse(res)
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
