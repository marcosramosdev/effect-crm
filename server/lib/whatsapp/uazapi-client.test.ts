import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import {
  createInstance,
  connect,
  disconnect,
  sendText,
  configureWebhook,
  UazapiUnauthorizedError,
  UazapiRateLimitedError,
  UazapiTransientError,
} from './uazapi-client'

const UAZAPI_BASE_URL = 'https://free.uazapi.com'
const ADMIN_TOKEN = 'test-admin-token'

process.env.UAZAPI_BASE_URL = UAZAPI_BASE_URL
process.env.UAZAPI_ADMIN_TOKEN = ADMIN_TOKEN

interface CapturedFetch {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
}

let lastFetch: CapturedFetch | null = null
const originalFetch = global.fetch

function mockFetch(status: number, responseBody: unknown, responseHeaders: Record<string, string> = {}) {
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    const headers: Record<string, string> = {}
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => { headers[k] = v })
      } else if (Array.isArray(init.headers)) {
        for (const [k, v] of init.headers) headers[k] = v
      } else {
        Object.assign(headers, init.headers)
      }
    }
    lastFetch = {
      url,
      method: init?.method ?? 'GET',
      headers,
      body: init?.body ? JSON.parse(init.body as string) : null,
    }
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/json', ...responseHeaders },
    })
  }
}

afterEach(() => {
  global.fetch = originalFetch
  lastFetch = null
})

describe('uazapi-client', () => {
  // T-S-010
  it('createInstance envia POST /instance/create com header admintoken correcto', async () => {
    mockFetch(200, { id: 'inst-001', token: 'inst-token-001' })

    await createInstance({ name: 'crm-tenant-001', adminField01: 'tenant-001' })

    expect(lastFetch).not.toBeNull()
    expect(lastFetch!.method).toBe('POST')
    expect(lastFetch!.url).toBe(`${UAZAPI_BASE_URL}/instance/create`)
    expect(lastFetch!.headers['admintoken']).toBe(ADMIN_TOKEN)
  })

  // T-S-011
  it('createInstance retorna { instanceId, token } a partir de resposta 200', async () => {
    mockFetch(200, { id: 'inst-001', token: 'inst-token-001' })

    const result = await createInstance({ name: 'crm-tenant-001' })

    expect(result).toEqual({ instanceId: 'inst-001', token: 'inst-token-001' })
  })

  // T-S-012
  it('connect envia POST /instance/connect com header token (instance-scoped) e body vazio', async () => {
    mockFetch(200, { qrcode: 'data:image/png;base64,xxx', status: 'connecting' })

    await connect('inst-token-001')

    expect(lastFetch!.method).toBe('POST')
    expect(lastFetch!.url).toBe(`${UAZAPI_BASE_URL}/instance/connect`)
    expect(lastFetch!.headers['token']).toBe('inst-token-001')
    expect(lastFetch!.body).toBeNull()
  })

  // T-S-013
  it('sendText monta POST /send/text com body correcto', async () => {
    mockFetch(200, { id: 'msg-001' })

    await sendText({ token: 'inst-token-001', number: '5511999999999', text: 'Olá!' })

    expect(lastFetch!.method).toBe('POST')
    expect(lastFetch!.url).toBe(`${UAZAPI_BASE_URL}/send/text`)
    expect(lastFetch!.headers['token']).toBe('inst-token-001')
    expect(lastFetch!.body).toEqual({ number: '5511999999999', text: 'Olá!' })
  })

  // T-S-014
  it('configureWebhook envia POST /webhook com body correcto', async () => {
    mockFetch(200, {})

    await configureWebhook({
      token: 'inst-token-001',
      url: 'https://example.com/webhook',
      events: ['messages', 'connection'],
      excludeMessages: ['wasSentByApi'],
    })

    expect(lastFetch!.method).toBe('POST')
    expect(lastFetch!.url).toBe(`${UAZAPI_BASE_URL}/webhook`)
    expect(lastFetch!.headers['token']).toBe('inst-token-001')
    expect(lastFetch!.body).toMatchObject({
      url: 'https://example.com/webhook',
      events: ['messages', 'connection'],
      excludeMessages: ['wasSentByApi'],
    })
  })

  // T-S-015
  it('401 da uazapi propaga como UazapiUnauthorizedError', async () => {
    mockFetch(401, { error: 'Unauthorized' })

    await expect(
      sendText({ token: 'bad-token', number: '111', text: 'test' }),
    ).rejects.toBeInstanceOf(UazapiUnauthorizedError)
  })

  // T-S-016
  it('429 da uazapi propaga como UazapiRateLimitedError com retryAfter', async () => {
    mockFetch(429, { error: 'Rate limited' }, { 'Retry-After': '30' })

    const err = await sendText({ token: 'inst-token', number: '111', text: 'test' }).catch((e) => e)

    expect(err).toBeInstanceOf(UazapiRateLimitedError)
    expect((err as UazapiRateLimitedError).retryAfter).toBe(30)
  })

  // T-S-017
  it('5xx da uazapi propaga como UazapiTransientError', async () => {
    mockFetch(500, { error: 'Internal Server Error' })

    await expect(
      sendText({ token: 'inst-token', number: '111', text: 'test' }),
    ).rejects.toBeInstanceOf(UazapiTransientError)
  })
})
