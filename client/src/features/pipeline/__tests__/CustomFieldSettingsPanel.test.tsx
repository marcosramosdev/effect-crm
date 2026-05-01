import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { overrideHandler } from '../../../test/msw/server'
import { CustomFieldSettingsPanel } from '../CustomFieldSettingsPanel'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
      signOut: vi.fn(),
    },
  },
}))

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

const NEW_FIELD = {
  id: '00000000-0000-4000-8000-000000000100',
  tenantId: 't-1',
  key: 'email_contact',
  label: 'Email de contato',
  type: 'email',
  options: null,
  order: 1,
  createdAt: '2024-01-01T00:00:00.000Z',
}

describe('CustomFieldSettingsPanel', () => {
  beforeEach(() => {
    overrideHandler(
      http.get('/api/pipeline/custom-fields', () =>
        HttpResponse.json({ fields: [] }),
      ),
    )
  })

  it('panel opens and shows heading', async () => {
    render(<CustomFieldSettingsPanel open onClose={vi.fn()} />, {
      wrapper: makeWrapper(),
    })
    await screen.findByText('Campos personalizados')
    expect(screen.getByText('Nenhum campo criado ainda.')).toBeInTheDocument()
  })

  it('panel hidden when open=false', () => {
    render(<CustomFieldSettingsPanel open={false} onClose={vi.fn()} />, {
      wrapper: makeWrapper(),
    })
    expect(screen.queryByText('Campos personalizados')).not.toBeInTheDocument()
  })

  it('creates email field and list reflects it without page reload', async () => {
    let created = false

    overrideHandler(
      http.get('/api/pipeline/custom-fields', () =>
        HttpResponse.json({ fields: created ? [NEW_FIELD] : [] }),
      ),
      http.post('/api/pipeline/custom-fields', async () => {
        created = true
        return HttpResponse.json({ field: NEW_FIELD }, { status: 201 })
      }),
    )

    render(<CustomFieldSettingsPanel open onClose={vi.fn()} />, {
      wrapper: makeWrapper(),
    })

    await screen.findByText('Campos personalizados')

    fireEvent.change(screen.getByLabelText(/Chave/i), {
      target: { value: 'email_contact' },
    })
    fireEvent.change(screen.getByLabelText(/Label/i), {
      target: { value: 'Email de contato' },
    })
    fireEvent.change(screen.getByLabelText(/Tipo/i), {
      target: { value: 'email' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Criar campo/i }))

    await waitFor(() => {
      expect(screen.getByText('Email de contato')).toBeInTheDocument()
    })
  })
})
