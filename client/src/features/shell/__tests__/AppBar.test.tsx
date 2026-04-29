import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AppBar } from '../AppBar'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
    },
  },
}))

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

const FILTERS = [
  { label: 'Pending', count: 4 },
  { label: 'Assigned', count: 15, active: true },
  { label: 'Completed', count: 10 },
]

describe('AppBar', () => {
  it('renders the page title', () => {
    render(<AppBar title="Pipeline" />, { wrapper: makeWrapper() })
    expect(
      screen.getByRole('heading', { name: 'Pipeline' }),
    ).toBeInTheDocument()
  })

  it('renders filter pills with counts', () => {
    render(<AppBar title="Dashboard" filters={FILTERS} />, {
      wrapper: makeWrapper(),
    })
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Assigned')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('active filter pill has aria-pressed="true"', () => {
    render(<AppBar title="Dashboard" filters={FILTERS} />, {
      wrapper: makeWrapper(),
    })
    const assignedBtn = screen.getByRole('button', { name: /Assigned/ })
    expect(assignedBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('inactive filter pills have aria-pressed="false"', () => {
    render(<AppBar title="Dashboard" filters={FILTERS} />, {
      wrapper: makeWrapper(),
    })
    expect(screen.getByRole('button', { name: /Pending/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('renders UserMenu (dropdown trigger visible)', async () => {
    render(<AppBar title="Dashboard" />, { wrapper: makeWrapper() })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument(),
    )
  })

  it('renders custom actions slot', () => {
    render(
      <AppBar title="Dashboard" actions={<button>Custom Action</button>} />,
      { wrapper: makeWrapper() },
    )
    expect(
      screen.getByRole('button', { name: 'Custom Action' }),
    ).toBeInTheDocument()
  })
})
