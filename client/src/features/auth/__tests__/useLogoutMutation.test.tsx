import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import type * as TanstackRouter from '@tanstack/react-router'
import { overrideHandler } from '../../../test/msw/server'
import { supabase } from '../../../lib/supabase'
import { useLogoutMutation } from '../useLogoutMutation'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof TanstackRouter>(
    '@tanstack/react-router',
  )
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, wrapper }
}

describe('useLogoutMutation', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    vi.mocked(supabase.auth.signOut).mockClear()
    overrideHandler(
      http.post(
        '/api/auth/logout',
        () => new HttpResponse(null, { status: 204 }),
      ),
    )
  })

  it('chama POST /api/auth/logout', async () => {
    let called = false
    overrideHandler(
      http.post('/api/auth/logout', () => {
        called = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useLogoutMutation(), { wrapper })

    result.current.mutate()
    await waitFor(() => expect(called).toBe(true))
  })

  it('onSuccess: signOut(local) + queryClient.clear() + navega para /', async () => {
    const { qc, wrapper } = makeWrapper()
    const clearSpy = vi.spyOn(qc, 'clear')

    const { result } = renderHook(() => useLogoutMutation(), { wrapper })
    result.current.mutate()
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled())

    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(clearSpy).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
  })

  it('onError com 401: ainda executa signOut(local) + clear + navega para /', async () => {
    overrideHandler(
      http.post('/api/auth/logout', () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
          { status: 401 },
        ),
      ),
    )
    const { qc, wrapper } = makeWrapper()
    const clearSpy = vi.spyOn(qc, 'clear')

    const { result } = renderHook(() => useLogoutMutation(), { wrapper })
    result.current.mutate()
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled())

    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(clearSpy).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
  })
})
