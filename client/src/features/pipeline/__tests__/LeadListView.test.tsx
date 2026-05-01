import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { overrideHandler } from '../../../test/msw/server'
import { LeadListView } from '../LeadListView'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
      signOut: vi.fn(),
    },
  },
}))

const STAGE_ID = '00000000-0000-0000-0003-000000000001'
const STAGE2_ID = '00000000-0000-0000-0003-000000000002'
const EMAIL_FIELD_ID = '00000000-0000-0000-0005-000000000001'

const stages = [
  {
    id: STAGE_ID,
    name: 'Novo',
    order: 1,
    isDefaultEntry: true,
    color: '#22c55e',
    description: null,
  },
  {
    id: STAGE2_ID,
    name: 'Fechado',
    order: 2,
    isDefaultEntry: false,
    color: '#ef4444',
    description: null,
  },
]

const customFields = [
  {
    id: EMAIL_FIELD_ID,
    tenantId: '00000000-0000-0000-0000-000000000002',
    key: 'email',
    label: 'Email',
    type: 'email',
    options: null,
    order: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
]

const leads = [
  {
    id: '00000000-0000-0000-0002-000000000001',
    displayName: 'Alice',
    phoneNumber: '+351912345678',
    stageId: STAGE_ID,
    position: 1024,
    createdAt: '2024-01-01T10:00:00.000Z',
    updatedAt: '2024-03-01T10:00:00.000Z',
    customValues: { [EMAIL_FIELD_ID]: 'alice@example.com' },
  },
  {
    id: '00000000-0000-0000-0002-000000000002',
    displayName: 'Bob',
    phoneNumber: '+351912345679',
    stageId: STAGE2_ID,
    position: 2048,
    createdAt: '2024-01-02T10:00:00.000Z',
    updatedAt: '2024-02-01T10:00:00.000Z',
    customValues: null,
  },
]

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('LeadListView', () => {
  beforeEach(() => {
    overrideHandler(
      http.get('/api/pipeline/stages', () => HttpResponse.json({ stages })),
      http.get('/api/pipeline/leads', () =>
        HttpResponse.json({ leads, nextCursor: null }),
      ),
      http.get('/api/pipeline/custom-fields', () =>
        HttpResponse.json({ fields: customFields }),
      ),
    )
  })

  it('renders lead rows', async () => {
    render(<LeadListView />, { wrapper: makeWrapper() })
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('shows stage badge with stage name', async () => {
    render(<LeadListView />, { wrapper: makeWrapper() })
    await screen.findByText('Alice')
    expect(screen.getByText('Novo')).toBeInTheDocument()
    expect(screen.getByText('Fechado')).toBeInTheDocument()
  })

  it('row click opens modal', async () => {
    render(<LeadListView />, { wrapper: makeWrapper() })
    await screen.findByText('Alice')
    fireEvent.click(screen.getByText('Alice').closest('tr')!)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('sort by displayName toggles aria-sort', async () => {
    render(<LeadListView />, { wrapper: makeWrapper() })
    await screen.findByText('Alice')
    const nameHeader = screen.getByRole('columnheader', { name: /Nome/i })
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
    fireEvent.click(nameHeader)
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending')
  })

  it('shows email custom field value', async () => {
    render(<LeadListView />, { wrapper: makeWrapper() })
    await screen.findByText('alice@example.com')
  })
})
