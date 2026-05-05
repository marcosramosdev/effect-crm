import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { overrideHandler } from '../../../test/msw/server'
import { ConnectScreen } from '../ConnectScreen'
import { instanceStatusQueryOptions } from '../useInstanceStatus'

const realtimeState = vi.hoisted(() => ({
  callbacks: [] as Array<(payload: { new: Record<string, unknown> }) => void>,
}))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
      signOut: vi.fn(),
    },
    channel: () => {
      const channel = {
        on: (
          _event: string,
          _filter: unknown,
          cb: (payload: { new: Record<string, unknown> }) => void,
        ) => {
          realtimeState.callbacks.push(cb)
          return channel
        },
        subscribe: () => channel,
      }
      return channel
    },
    removeChannel: vi.fn(),
  },
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

const ownerAuth = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'owner@test.example',
  tenantId: '00000000-0000-0000-0000-000000000002',
  tenantName: 'Test Tenant',
  role: 'owner' as const,
}

const agentAuth = {
  ...ownerAuth,
  role: 'agent' as const,
}

function statusPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    status: 'disconnected',
    instanceName: null,
    phoneNumber: null,
    lastHeartbeatAt: null,
    lastError: null,
    qrExpiresAt: null,
    qr: null,
    ...overrides,
  }
}

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function showModal() {
      this.setAttribute('open', '')
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function close() {
      this.removeAttribute('open')
    },
  })
})

describe('ConnectScreen', () => {
  beforeEach(() => {
    realtimeState.callbacks.length = 0
    vi.useRealTimers()
  })

  // 8.1
  it.each([
    {
      title: 'renders no_instance state',
      payload: statusPayload({ status: 'disconnected', instanceName: null }),
      matcher: /nome da instância/i,
      byLabel: true,
    },
    {
      title: 'renders disconnected state',
      payload: statusPayload({
        status: 'disconnected',
        instanceName: 'Empresa X',
      }),
      matcher: /instância desconectada/i,
    },
    {
      title: 'renders qr_pending valid state',
      payload: statusPayload({
        status: 'qr_pending',
        qr: 'data:image/png;base64,qr',
        qrExpiresAt: new Date(Date.now() + 120_000).toISOString(),
      }),
      matcher: /expira em \d+:\d+/i,
    },
    {
      title: 'renders qr_pending expired state',
      payload: statusPayload({
        status: 'qr_pending',
        qr: null,
        qrExpiresAt: new Date(Date.now() - 1_000).toISOString(),
      }),
      matcher: /qr expirado/i,
    },
    {
      title: 'renders connecting state',
      payload: statusPayload({ status: 'connecting' }),
      matcher: /sincronizando com whatsapp/i,
    },
    {
      title: 'renders connected state',
      payload: statusPayload({
        status: 'connected',
        instanceName: 'Empresa X',
        phoneNumber: '5511999999999',
      }),
      matcher: /whatsapp conectado/i,
    },
    {
      title: 'renders error state',
      payload: statusPayload({ status: 'error', lastError: 'Falha na sessão' }),
      matcher: /erro na conexão/i,
    },
  ])('$title', async ({ payload, matcher, byLabel }) => {
    overrideHandler(
      http.get('/api/auth/me', () => HttpResponse.json(ownerAuth)),
      http.get('/api/whatsapp/instance/status', () =>
        HttpResponse.json(payload),
      ),
    )

    render(<ConnectScreen />, { wrapper: makeWrapper() })
    if (byLabel) {
      expect(await screen.findByLabelText(matcher)).toBeInTheDocument()
    } else {
      expect(await screen.findByText(matcher)).toBeInTheDocument()
    }
  })

  // 8.2
  it('prefills tenant name and submits create mutation', async () => {
    let createBody: unknown = null
    overrideHandler(
      http.get('/api/auth/me', () => HttpResponse.json(ownerAuth)),
      http.get('/api/whatsapp/instance/status', () =>
        HttpResponse.json(
          statusPayload({ status: 'disconnected', instanceName: null }),
        ),
      ),
      http.post('/api/whatsapp/instance', async ({ request }) => {
        createBody = await request.json()
        return HttpResponse.json(
          { instanceId: 'inst-1', name: 'Test Tenant', status: 'disconnected' },
          { status: 201 },
        )
      }),
    )

    render(<ConnectScreen />, { wrapper: makeWrapper() })

    const input = await screen.findByLabelText(/nome da instância/i)
    expect(input).toHaveValue('Test Tenant')
    fireEvent.click(screen.getByRole('button', { name: /criar instância/i }))

    await waitFor(() => expect(createBody).toEqual({ name: 'Test Tenant' }))
  })

  // 8.3
  it('shows "Gerar novo QR" when QR expires and calls connect mutation', async () => {
    let connectCalls = 0
    overrideHandler(
      http.get('/api/auth/me', () => HttpResponse.json(ownerAuth)),
      http.get('/api/whatsapp/instance/status', () =>
        HttpResponse.json(
          statusPayload({
            status: 'qr_pending',
            instanceName: 'Empresa X',
            qr: null,
            qrExpiresAt: new Date(Date.now() - 5_000).toISOString(),
          }),
        ),
      ),
      http.post('/api/whatsapp/instance/connect', () => {
        connectCalls += 1
        return HttpResponse.json({
          status: 'qr_pending',
          qr: 'data:image/png;base64,new-qr',
          qrExpiresAt: new Date(Date.now() + 120_000).toISOString(),
        })
      }),
    )

    render(<ConnectScreen />, { wrapper: makeWrapper() })
    const button = await screen.findByRole('button', { name: /gerar novo qr/i })
    fireEvent.click(button)
    await waitFor(() => expect(connectCalls).toBe(1))
  })

  it('keeps showing qr from connect response even if status refresh has no qr', async () => {
    overrideHandler(
      http.get('/api/auth/me', () => HttpResponse.json(ownerAuth)),
      http.get('/api/whatsapp/instance/status', () =>
        HttpResponse.json(
          statusPayload({
            status: 'disconnected',
            instanceName: 'Empresa X',
            qr: null,
            qrExpiresAt: null,
          }),
        ),
      ),
      http.post('/api/whatsapp/instance/connect', () =>
        HttpResponse.json({
          status: 'qr_pending',
          qr: 'data:image/png;base64,new-qr',
          qrExpiresAt: new Date(Date.now() + 120_000).toISOString(),
        }),
      ),
    )

    render(<ConnectScreen />, { wrapper: makeWrapper() })
    fireEvent.click(
      await screen.findByRole('button', { name: /conectar agora/i }),
    )

    expect(
      await screen.findByAltText(/qr code do whatsapp/i),
    ).toBeInTheDocument()
  })

  // 8.4
  it('opens delete modal, cancel does not call delete, confirm calls delete', async () => {
    let deleteCalls = 0
    overrideHandler(
      http.get('/api/auth/me', () => HttpResponse.json(ownerAuth)),
      http.get('/api/whatsapp/instance/status', () =>
        HttpResponse.json(
          statusPayload({ status: 'disconnected', instanceName: 'Empresa X' }),
        ),
      ),
      http.delete('/api/whatsapp/instance', () => {
        deleteCalls += 1
        return new HttpResponse(null, { status: 204 })
      }),
    )

    render(<ConnectScreen />, { wrapper: makeWrapper() })

    const openModalButton = await screen.findByRole('button', {
      name: /excluir instância/i,
    })
    fireEvent.click(openModalButton)

    const cancelButton = await screen.findByRole('button', {
      name: /cancelar/i,
    })
    fireEvent.click(cancelButton)
    expect(deleteCalls).toBe(0)

    fireEvent.click(
      await screen.findByRole('button', { name: /excluir instância/i }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: /confirmar exclusão/i }),
    )

    await waitFor(() => expect(deleteCalls).toBe(1))
  })

  // 8.5
  it('polls only for qr_pending/connecting states', () => {
    expect(
      instanceStatusQueryOptions.refetchInterval({
        state: { data: statusPayload({ status: 'qr_pending' }) as never },
      }),
    ).toBe(3000)
    expect(
      instanceStatusQueryOptions.refetchInterval({
        state: { data: statusPayload({ status: 'connecting' }) as never },
      }),
    ).toBe(3000)
    expect(
      instanceStatusQueryOptions.refetchInterval({
        state: { data: statusPayload({ status: 'connected' }) as never },
      }),
    ).toBe(false)
  })

  it('hides mutation controls for non-owner', async () => {
    overrideHandler(
      http.get('/api/auth/me', () => HttpResponse.json(agentAuth)),
      http.get('/api/whatsapp/instance/status', () =>
        HttpResponse.json(
          statusPayload({ status: 'disconnected', instanceName: 'Empresa X' }),
        ),
      ),
    )

    render(<ConnectScreen />, { wrapper: makeWrapper() })
    await screen.findByText(/apenas o proprietário pode gerenciar a conexão/i)
    expect(
      screen.queryByRole('button', { name: /conectar agora/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /excluir instância/i }),
    ).not.toBeInTheDocument()
  })

  it('keeps showing qr while provider status is connecting', async () => {
    overrideHandler(
      http.get('/api/auth/me', () => HttpResponse.json(ownerAuth)),
      http.get('/api/whatsapp/instance/status', () =>
        HttpResponse.json(
          statusPayload({
            status: 'connecting',
            qr: 'data:image/png;base64,qr',
            qrExpiresAt: new Date(Date.now() + 120_000).toISOString(),
          }),
        ),
      ),
    )

    render(<ConnectScreen />, { wrapper: makeWrapper() })
    expect(
      await screen.findByAltText(/qr code do whatsapp/i),
    ).toBeInTheDocument()
  })
})
