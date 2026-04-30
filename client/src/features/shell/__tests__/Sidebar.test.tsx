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
      expect(screen.getByTitle('Dashboard')).toBeInTheDocument()
      expect(screen.getByTitle('Inbox')).toBeInTheDocument()
      expect(screen.getByTitle('Pipeline')).toBeInTheDocument()
      expect(screen.getByTitle('Conectar')).toBeInTheDocument()
      expect(screen.getByTitle('Configurar')).toBeInTheDocument()
    })
  })

  it('non-owner hides owner-only items (Conectar + Configurar)', async () => {
    render(<Sidebar />, { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(screen.getByTitle('Dashboard')).toBeInTheDocument()
      expect(screen.getByTitle('Inbox')).toBeInTheDocument()
      expect(screen.getByTitle('Pipeline')).toBeInTheDocument()
    })

    expect(screen.queryByTitle('Conectar')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Configurar')).not.toBeInTheDocument()
  })

  it('active route link has aria-current="page"', async () => {
    routerState.pathname = '/app/inbox'

    render(<Sidebar />, { wrapper: makeWrapper() })

    await waitFor(() => expect(screen.getByTitle('Inbox')).toBeInTheDocument())

    expect(screen.getByTitle('Inbox')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTitle('Dashboard')).not.toHaveAttribute('aria-current')
  })
})
