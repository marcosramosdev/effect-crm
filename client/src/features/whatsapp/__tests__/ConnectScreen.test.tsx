import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { overrideHandler } from '../../../test/msw/server'
import { ConnectScreen } from '../ConnectScreen'

const realtimeState = vi.hoisted(() => ({
  callbacks: [] as Array<(payload: { new: Record<string, unknown> }) => void>,
}))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signOut: vi.fn(),
    },
    channel: () => ({
      on: (
        _event: string,
        _filter: unknown,
        cb: (payload: { new: Record<string, unknown> }) => void,
      ) => {
        realtimeState.callbacks.push(cb)
        return { subscribe: vi.fn() }
      },
    }),
    removeChannel: vi.fn(),
  },
}))

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

const ownerAuth = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'owner@test.example',
  tenantId: '00000000-0000-0000-0000-000000000002',
  tenantName: 'Test Tenant',
  role: 'owner' as const,
}

describe('ConnectScreen', () => {
  beforeEach(() => {
    realtimeState.callbacks.length = 0
  })

  // T-C-010
  it('shows QR image when status is qr_pending', async () => {
    overrideHandler(
      http.get('/api/auth/me', () => HttpResponse.json(ownerAuth)),
      http.get('/api/whatsapp/connection', () =>
        HttpResponse.json({
          status: 'qr_pending',
          qr: 'data:image/png;base64,abc123',
          phoneNumber: null,
          lastHeartbeatAt: null,
          lastError: null,
        }),
      ),
    )

    render(<ConnectScreen />, { wrapper: makeWrapper() })

    const qrImage = await screen.findByRole('img', { name: /qr code/i })
    expect(qrImage).toBeInTheDocument()
    expect(qrImage).toHaveAttribute('src', 'data:image/png;base64,abc123')
  })

  // T-C-011
  it('updates to connected when realtime event is received', async () => {
    overrideHandler(
      http.get('/api/whatsapp/connection', () =>
        HttpResponse.json({
          status: 'disconnected',
          qr: null,
          phoneNumber: null,
          lastHeartbeatAt: null,
          lastError: null,
        }),
      ),
    )

    render(<ConnectScreen />, { wrapper: makeWrapper() })

    await waitFor(() => expect(realtimeState.callbacks.length).toBeGreaterThan(0))

    act(() => {
      realtimeState.callbacks[0]({
        new: {
          status: 'connected',
          phone_number: '+351912345678',
          last_heartbeat_at: new Date().toISOString(),
          last_error: null,
        },
      })
    })

    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument()
    })
  })

  // T-C-012
  it('connect button calls POST /api/whatsapp/connection when disconnected', async () => {
    overrideHandler(
      http.get('/api/auth/me', () => HttpResponse.json(ownerAuth)),
      http.get('/api/whatsapp/connection', () =>
        HttpResponse.json({
          status: 'disconnected',
          qr: null,
          phoneNumber: null,
          lastHeartbeatAt: null,
          lastError: null,
        }),
      ),
    )

    let postCalled = false
    overrideHandler(
      http.post('/api/whatsapp/connection', () => {
        postCalled = true
        return HttpResponse.json({ status: 'qr_pending', qr: null })
      }),
    )

    render(<ConnectScreen />, { wrapper: makeWrapper() })

    const connectButton = await screen.findByRole('button', { name: /connect/i })
    fireEvent.click(connectButton)

    await waitFor(() => expect(postCalled).toBe(true))
  })

  // T-C-013
  it('agent does not see the connect button', async () => {
    // default handler returns role: 'agent'
    overrideHandler(
      http.get('/api/whatsapp/connection', () =>
        HttpResponse.json({
          status: 'disconnected',
          qr: null,
          phoneNumber: null,
          lastHeartbeatAt: null,
          lastError: null,
        }),
      ),
    )

    render(<ConnectScreen />, { wrapper: makeWrapper() })

    await screen.findByText(/whatsapp is disconnected/i)

    expect(screen.queryByRole('button', { name: /connect/i })).not.toBeInTheDocument()
  })
})
