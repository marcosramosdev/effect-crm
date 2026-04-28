import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { overrideHandler } from '../../test/msw/server'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
      signOut: vi.fn(),
    },
  },
}))

describe('route guards', () => {
  // T-C-002
  it('/app/settings/pipeline redirects agent to /app/inbox', async () => {
    overrideHandler(
      http.get('/api/auth/me', () =>
        HttpResponse.json({
          userId: '00000000-0000-0000-0000-000000000001',
          email: 'agent@test.example',
          tenantId: '00000000-0000-0000-0000-000000000002',
          tenantName: 'Test Tenant',
          role: 'agent',
        }),
      ),
    )

    const { Route } = await import('../app/settings/pipeline')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    let thrown: unknown
    try {
      await (Route.options.beforeLoad as (ctx: unknown) => Promise<void>)({
        context: { queryClient },
      })
    } catch (e) {
      thrown = e
    }

    expect(thrown).toBeDefined()
    const redirectOpts = (thrown as { options?: { to?: string } }).options
    expect(redirectOpts?.to).toBe('/app/inbox')
  })

  // T016 — US1
  it('/ sem sessão renderiza HomePage', async () => {
    overrideHandler(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      ),
    )

    const { Route } = await import('../index')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    let thrown: unknown
    try {
      await (Route.options.beforeLoad as (ctx: unknown) => Promise<void>)({
        context: { queryClient },
      })
    } catch (e) {
      thrown = e
    }

    expect(thrown).toBeUndefined()
  })

  it('/ com sessão redireciona para /app', async () => {
    overrideHandler(
      http.get('/api/auth/me', () =>
        HttpResponse.json({
          userId: '00000000-0000-0000-0000-000000000001',
          email: 'user@test.example',
          tenantId: '00000000-0000-0000-0000-000000000002',
          tenantName: 'Test Tenant',
          role: 'owner',
        }),
      ),
    )

    const { Route } = await import('../index')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    let thrown: unknown
    try {
      await (Route.options.beforeLoad as (ctx: unknown) => Promise<void>)({
        context: { queryClient },
      })
    } catch (e) {
      thrown = e
    }

    expect(thrown).toBeDefined()
    const redirectOpts = (thrown as { options?: { to?: string } }).options
    expect(redirectOpts?.to).toBe('/app')
  })

  // T040 — /auth/* matrix

  it('/auth/login sem sessão renderiza form', async () => {
    overrideHandler(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      ),
    )

    const { Route } = await import('../auth')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    let thrown: unknown
    try {
      await (Route.options.beforeLoad as (ctx: unknown) => Promise<void>)({
        context: { queryClient },
      })
    } catch (e) {
      thrown = e
    }

    expect(thrown).toBeUndefined()
  })

  it('/auth/login com sessão redireciona para /app', async () => {
    overrideHandler(
      http.get('/api/auth/me', () =>
        HttpResponse.json({
          userId: '00000000-0000-0000-0000-000000000001',
          email: 'user@test.example',
          tenantId: '00000000-0000-0000-0000-000000000002',
          tenantName: 'Test Tenant',
          role: 'owner',
        }),
      ),
    )

    const { Route } = await import('../auth')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    let thrown: unknown
    try {
      await (Route.options.beforeLoad as (ctx: unknown) => Promise<void>)({
        context: { queryClient },
      })
    } catch (e) {
      thrown = e
    }

    expect(thrown).toBeDefined()
    const redirectOpts = (thrown as { options?: { to?: string } }).options
    expect(redirectOpts?.to).toBe('/app')
  })

  it('/auth/register sem sessão renderiza form', async () => {
    overrideHandler(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      ),
    )

    const { Route } = await import('../auth')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    let thrown: unknown
    try {
      await (Route.options.beforeLoad as (ctx: unknown) => Promise<void>)({
        context: { queryClient },
      })
    } catch (e) {
      thrown = e
    }

    expect(thrown).toBeUndefined()
  })

  it('/auth/register com sessão redireciona para /app', async () => {
    overrideHandler(
      http.get('/api/auth/me', () =>
        HttpResponse.json({
          userId: '00000000-0000-0000-0000-000000000001',
          email: 'user@test.example',
          tenantId: '00000000-0000-0000-0000-000000000002',
          tenantName: 'Test Tenant',
          role: 'owner',
        }),
      ),
    )

    const { Route } = await import('../auth')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    let thrown: unknown
    try {
      await (Route.options.beforeLoad as (ctx: unknown) => Promise<void>)({
        context: { queryClient },
      })
    } catch (e) {
      thrown = e
    }

    expect(thrown).toBeDefined()
    const redirectOpts = (thrown as { options?: { to?: string } }).options
    expect(redirectOpts?.to).toBe('/app')
  })

  // T040 — /app/* matrix

  it('/app/inbox com sessão não redireciona', async () => {
    overrideHandler(
      http.get('/api/auth/me', () =>
        HttpResponse.json({
          userId: '00000000-0000-0000-0000-000000000001',
          email: 'user@test.example',
          tenantId: '00000000-0000-0000-0000-000000000002',
          tenantName: 'Test Tenant',
          role: 'owner',
        }),
      ),
    )

    const { Route } = await import('../app')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    let thrown: unknown
    try {
      await (Route.options.beforeLoad as (ctx: unknown) => Promise<void>)({
        context: { queryClient },
        location: { href: '/app/inbox' },
      })
    } catch (e) {
      thrown = e
    }

    expect(thrown).toBeUndefined()
  })

  it('/app/inbox sem sessão redireciona para /auth/login preservando search.redirect', async () => {
    overrideHandler(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      ),
    )

    const { Route } = await import('../app')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    let thrown: unknown
    try {
      await (Route.options.beforeLoad as (ctx: unknown) => Promise<void>)({
        context: { queryClient },
        location: { href: '/app/inbox' },
      })
    } catch (e) {
      thrown = e
    }

    expect(thrown).toBeDefined()
    const redirectOpts = (
      thrown as { options?: { to?: string; search?: { redirect?: string } } }
    ).options
    expect(redirectOpts?.to).toBe('/auth/login')
    expect(redirectOpts?.search?.redirect).toBe('/app/inbox')
  })

  // T040 — 404 matrix

  it('/app/foo-inexistente e /qualquer-coisa: notFoundComponent mostra "Página não encontrada"', async () => {
    const { Route } = await import('../__root')
    expect(Route.options.notFoundComponent).toBeDefined()

    const NotFound = Route.options.notFoundComponent as React.ComponentType<any>
    render(<NotFound isNotFound={true} routeId="__root__" />)

    expect(screen.getByText('Página não encontrada.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /voltar/i })).toBeInTheDocument()
  })
})
