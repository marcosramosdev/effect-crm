import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type * as TanstackRouter from '@tanstack/react-router'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof TanstackRouter>(
    '@tanstack/react-router',
  )
  return {
    ...actual,
    createFileRoute: () => (opts: { component: unknown }) => opts,
    useRouterState: ({
      select,
    }: {
      select: (s: { location: { pathname: string } }) => string
    }) => select({ location: { pathname: '/app/dashboard' } }),
    Link: ({
      children,
      to,
      title,
      className,
      'aria-current': ariaCurrent,
    }: {
      children: ReactNode
      to: string
      title?: string
      className?: string
      'aria-current'?: string
    }) => (
      <a
        href={to}
        title={title}
        className={className}
        aria-current={ariaCurrent}
      >
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

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('DashboardPage', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  it('renders at least one KPI tile', async () => {
    const { DashboardPage } = await import('../index')
    render(<DashboardPage />, { wrapper: makeWrapper() })

    const tiles = screen.getAllByTestId('kpi-tile')
    expect(tiles.length).toBeGreaterThanOrEqual(1)
  })

  it('renders exactly 3 kanban column headers', async () => {
    const { DashboardPage } = await import('../index')
    render(<DashboardPage />, { wrapper: makeWrapper() })

    const headers = screen.getAllByTestId('kanban-column-header')
    expect(headers).toHaveLength(3)
  })

  it('renders the promo card CTA', async () => {
    const { DashboardPage } = await import('../index')
    render(<DashboardPage />, { wrapper: makeWrapper() })

    expect(
      screen.getByRole('button', { name: 'Ver Premium' }),
    ).toBeInTheDocument()
  })

  it('makes no dashboard-specific API calls (data comes from mockData)', async () => {
    const { DashboardPage } = await import('../index')
    const callsBefore = fetchSpy.mock.calls.length
    render(<DashboardPage />, { wrapper: makeWrapper() })
    const callsAfter = fetchSpy.mock.calls.length

    const dashboardCalls = fetchSpy.mock.calls
      .slice(callsBefore)
      .filter(([url]) => {
        const u = String(url)
        return (
          u.includes('/pipeline') ||
          u.includes('/leads') ||
          u.includes('/dashboard')
        )
      })
    expect(dashboardCalls).toHaveLength(0)
  })
})
