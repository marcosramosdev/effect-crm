import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { overrideHandler } from '../../../test/msw/server'
import { supabase } from '../../../lib/supabase'
import { useLoginMutation } from '../useLoginMutation'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      setSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn(),
    },
  },
}))

const VALID_INPUT = { email: 'user@test.com', password: 'password123' }
const MOCK_SESSION = { accessToken: 'tok_a', refreshToken: 'tok_r', expiresAt: 9999999999 }

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, wrapper }
}

describe('useLoginMutation', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    vi.mocked(supabase.auth.setSession).mockClear()
    overrideHandler(
      http.post('/api/auth/login', () => HttpResponse.json(MOCK_SESSION, { status: 200 })),
    )
  })

  it('envia {email, password} no body do POST', async () => {
    let capturedBody: unknown
    overrideHandler(
      http.post('/api/auth/login', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(MOCK_SESSION, { status: 200 })
      }),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useLoginMutation(), { wrapper })

    result.current.mutate(VALID_INPUT)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(capturedBody).toMatchObject(VALID_INPUT)
  })

  it('onSuccess sem redirect: chama setSession, invalida auth/me e navega para /app', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useLoginMutation(), { wrapper })
    result.current.mutate(VALID_INPUT)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'tok_a',
      refresh_token: 'tok_r',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['auth', 'me'] })
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/app' })
  })

  it('onSuccess com redirectTo: navega para a URL preservada', async () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useLoginMutation('/app/inbox'), { wrapper })

    result.current.mutate(VALID_INPUT)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/app/inbox' })
  })

  it('onError: não chama setSession nem navega', async () => {
    overrideHandler(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          { error: { code: 'INVALID_CREDENTIALS', message: 'Email ou senha inválidos.' } },
          { status: 401 },
        ),
      ),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useLoginMutation(), { wrapper })

    result.current.mutate(VALID_INPUT)
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(supabase.auth.setSession).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
