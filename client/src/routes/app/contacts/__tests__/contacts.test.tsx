import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type * as TanstackRouter from '@tanstack/react-router'

let mockView: 'board' | 'list' = 'board'
const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof TanstackRouter>(
    '@tanstack/react-router',
  )
  return {
    ...actual,
    createFileRoute:
      () =>
      (opts: Record<string, unknown>) => ({
        ...opts,
        useSearch: () => ({ view: mockView }),
      }),
    useNavigate: () => mockNavigate,
    useRouterState: ({
      select,
    }: {
      select: (s: { location: { pathname: string } }) => string
    }) => select({ location: { pathname: '/app/contacts' } }),
    Link: ({
      children,
      to,
      className,
      'aria-current': ariaCurrent,
    }: {
      children: ReactNode
      to: string
      className?: string
      'aria-current'?: string
    }) => (
      <a href={to} className={className} aria-current={ariaCurrent}>
        {children}
      </a>
    ),
  }
})

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
    },
  },
}))

vi.mock('../../../../features/pipeline/PipelineBoard', () => ({
  PipelineBoard: () => <div data-testid="pipeline-board" />,
}))

vi.mock('../../../../features/pipeline/LeadListView', () => ({
  LeadListView: () => <div data-testid="lead-list-view" />,
}))

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('ContactsPage', () => {
  beforeEach(() => {
    mockView = 'board'
    mockNavigate.mockClear()
  })

  it('renders board view by default', async () => {
    const mod = await import('../index')
    const ContactsPage = (mod.Route as { component: React.ComponentType }).component
    render(<ContactsPage />, { wrapper: makeWrapper() })
    expect(screen.getByTestId('pipeline-board')).toBeInTheDocument()
    expect(screen.queryByTestId('lead-list-view')).not.toBeInTheDocument()
  })

  it('renders list view when ?view=list', async () => {
    mockView = 'list'
    const mod = await import('../index')
    const ContactsPage = (mod.Route as { component: React.ComponentType }).component
    render(<ContactsPage />, { wrapper: makeWrapper() })
    expect(screen.getByTestId('lead-list-view')).toBeInTheDocument()
    expect(screen.queryByTestId('pipeline-board')).not.toBeInTheDocument()
  })

  it('clicking List tab navigates with view=list', async () => {
    const mod = await import('../index')
    const ContactsPage = (mod.Route as { component: React.ComponentType }).component
    render(<ContactsPage />, { wrapper: makeWrapper() })
    fireEvent.click(screen.getByRole('tab', { name: 'List' }))
    expect(mockNavigate).toHaveBeenCalledWith({ search: { view: 'list' } })
  })

  it('clicking Board tab navigates with view=board', async () => {
    mockView = 'list'
    const mod = await import('../index')
    const ContactsPage = (mod.Route as { component: React.ComponentType }).component
    render(<ContactsPage />, { wrapper: makeWrapper() })
    fireEvent.click(screen.getByRole('tab', { name: 'Board' }))
    expect(mockNavigate).toHaveBeenCalledWith({ search: { view: 'board' } })
  })

  it('subtitle is rendered', async () => {
    const mod = await import('../index')
    const ContactsPage = (mod.Route as { component: React.ComponentType }).component
    render(<ContactsPage />, { wrapper: makeWrapper() })
    expect(
      screen.getByText('Centralize e organize todos os seus leads em um só lugar'),
    ).toBeInTheDocument()
  })
})
