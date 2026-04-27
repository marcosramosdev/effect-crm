import { describe, it, expect, vi } from 'vitest'
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
})
