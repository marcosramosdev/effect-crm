import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { overrideHandler } from '../../../test/msw/server'
import { LeadFormModal } from '../LeadFormModal'

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

const STAGE_ID = '00000000-0000-4000-8000-000000000001'

describe('LeadFormModal', () => {
  beforeEach(() => {
    overrideHandler(
      http.get('/api/pipeline/custom-fields', () =>
        HttpResponse.json({
          fields: [
            {
              id: 'f-1',
              tenantId: 't-1',
              key: 'company',
              label: 'Empresa',
              type: 'text',
              options: null,
              order: 1,
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          ],
        }),
      ),
    )
  })

  it('renders create mode with validation errors', async () => {
    render(
      <LeadFormModal open mode="create" stageId={STAGE_ID} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    )

    await screen.findByText('Novo Lead')
    await screen.findByPlaceholderText('Nome do lead')
    await screen.findByPlaceholderText('+351900000001')
    await screen.findByPlaceholderText('Empresa')
  })

  it('surfaces duplicate phone error', async () => {
    overrideHandler(
      http.post('/api/pipeline/leads', () =>
        HttpResponse.json(
          {
            error: { code: 'LEAD_PHONE_EXISTS', message: 'Telefone duplicado' },
          },
          { status: 409 },
        ),
      ),
    )

    render(
      <LeadFormModal open mode="create" stageId={STAGE_ID} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    )

    await screen.findByText('Novo Lead')
    await screen.findByPlaceholderText('+351900000001')

    fireEvent.change(screen.getByPlaceholderText('+351900000001'), {
      target: { value: '+351912345678' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Criar/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/Número de telefone já existe/i),
      ).toBeInTheDocument()
    })
  })
})
