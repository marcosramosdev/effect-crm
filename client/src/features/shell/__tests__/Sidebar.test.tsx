import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import type * as TanstackRouter from '@tanstack/react-router'
import { overrideHandler } from '../../../test/msw/server'
import { Sidebar } from '../Sidebar'

const routerState = vi.hoisted(() => ({ pathname: '/app/dashboard' }))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof TanstackRouter>(
    '@tanstack/react-router',
  )
  return {
    ...actual,
    useRouterState: ({
      select,
    }: {
      select: (s: { location: { pathname: string } }) => string
    }) => select({ location: { pathname: routerState.pathname } }),
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

describe('Sidebar', () => {
  beforeEach(() => {
    routerState.pathname = '/app/dashboard'
  })

  it('owner sees all 5 nav items', async () => {
    overrideHandler(
      http.get('/api/auth/me', () =>
        HttpResponse.json({
          userId: '1',
          email: 'owner@test.example',
          tenantId: '2',
          tenantName: 'Tenant',
          role: 'owner',
        }),
      ),
    )

    render(<Sidebar />, { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Painel')).toBeInTheDocument()
      expect(screen.getByText('Caixa de entrada')).toBeInTheDocument()
      expect(screen.getByText('Pipeline')).toBeInTheDocument()
      expect(screen.getByText('Conectar')).toBeInTheDocument()
      expect(screen.getByText('Configurações')).toBeInTheDocument()
    })
  })

  it('non-owner hides owner-only items (Conectar + Configurações)', async () => {
    render(<Sidebar />, { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Painel')).toBeInTheDocument()
      expect(screen.getByText('Caixa de entrada')).toBeInTheDocument()
      expect(screen.getByText('Pipeline')).toBeInTheDocument()
    })

    expect(screen.queryByText('Conectar')).not.toBeInTheDocument()
    expect(screen.queryByText('Configurações')).not.toBeInTheDocument()
  })

  it('active route link has aria-current="page"', async () => {
    routerState.pathname = '/app/inbox'

    render(<Sidebar />, { wrapper: makeWrapper() })

    await waitFor(() =>
      expect(screen.getByText('Caixa de entrada')).toBeInTheDocument(),
    )

    const inboxLink = screen
      .getByText('Caixa de entrada')
      .closest('a') as HTMLAnchorElement
    expect(inboxLink).toHaveAttribute('aria-current', 'page')

    const dashboardLink = screen
      .getByText('Painel')
      .closest('a') as HTMLAnchorElement
    expect(dashboardLink).not.toHaveAttribute('aria-current')
  })

  it('support block is present with CTA button', async () => {
    render(<Sidebar />, { wrapper: makeWrapper() })

    await waitFor(() =>
      expect(screen.getByText('Precisa de ajuda?')).toBeInTheDocument(),
    )
    expect(
      screen.getByRole('button', { name: /falar conosco/i }),
    ).toBeInTheDocument()
  })

  it('user profile block is present at bottom', async () => {
    render(<Sidebar />, { wrapper: makeWrapper() })

    await waitFor(() =>
      expect(screen.getByText('Test Tenant')).toBeInTheDocument(),
    )
  })
})
