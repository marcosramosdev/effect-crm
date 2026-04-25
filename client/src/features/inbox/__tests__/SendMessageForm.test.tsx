import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { overrideHandler } from '../../../test/msw/server'
import { SendMessageForm } from '../SendMessageForm'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
      signOut: vi.fn(),
    },
    channel: () => ({
      on: () => ({ subscribe: vi.fn() }),
    }),
    removeChannel: vi.fn(),
  },
}))

const CONV_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

const happyResponse = {
  message: {
    id: 'msg-1',
    conversationId: CONV_ID,
    direction: 'outbound',
    contentType: 'text',
    text: 'olá',
    sentByUserId: null,
    status: 'pending',
    error: null,
    createdAt: new Date().toISOString(),
    readAt: null,
  },
}

describe('SendMessageForm', () => {
  beforeEach(() => {
    overrideHandler(
      http.post(`/api/inbox/conversations/${CONV_ID}/messages`, () =>
        HttpResponse.json(happyResponse, { status: 202 }),
      ),
    )
  })

  // T-C-022
  it('submit button is disabled when text is empty and enabled once text is entered', () => {
    render(<SendMessageForm conversationId={CONV_ID} />, {
      wrapper: makeWrapper(),
    })

    const button = screen.getByRole('button', { name: /enviar/i })
    expect(button).toBeDisabled()

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'hello' } })
    expect(button).not.toBeDisabled()

    fireEvent.change(textarea, { target: { value: '   ' } })
    expect(button).toBeDisabled()

    fireEvent.change(textarea, { target: { value: '' } })
    expect(button).toBeDisabled()
  })

  // T-C-023
  it('shows "Reconecte o WhatsApp" alert on 409 and preserves typed text', async () => {
    overrideHandler(
      http.post(`/api/inbox/conversations/${CONV_ID}/messages`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'WHATSAPP_DISCONNECTED',
              message: 'WhatsApp não está conectado',
            },
          },
          { status: 409 },
        ),
      ),
    )

    render(<SendMessageForm conversationId={CONV_ID} />, {
      wrapper: makeWrapper(),
    })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'olá mundo' } })

    fireEvent.click(screen.getByRole('button', { name: /enviar/i }))

    await screen.findByText('Reconecte o WhatsApp')
    expect(screen.getByRole('textbox')).toHaveValue('olá mundo')
  })

  // T-C-024
  it('shows retry hint with seconds count on 429 response using Retry-After header', async () => {
    overrideHandler(
      http.post(
        `/api/inbox/conversations/${CONV_ID}/messages`,
        () =>
          new HttpResponse(null, {
            status: 429,
            headers: { 'Retry-After': '45' },
          }),
      ),
    )

    render(<SendMessageForm conversationId={CONV_ID} />, {
      wrapper: makeWrapper(),
    })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'test message' } })

    fireEvent.click(screen.getByRole('button', { name: /enviar/i }))

    await waitFor(() =>
      expect(
        screen.getByText(/Tente novamente em 45 segundos/),
      ).toBeInTheDocument(),
    )
  })
})
