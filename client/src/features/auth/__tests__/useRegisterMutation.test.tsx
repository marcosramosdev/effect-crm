import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { overrideHandler } from '../../../test/msw/server'
import { supabase } from '../../../lib/supabase'
import { useRegisterMutation } from '../useRegisterMutation'

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

const VALID_INPUT = { email: 'user@test.com', password: 'password123', tenantName: 'Test Corp' }
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

describe('useRegisterMutation', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
    vi.mocked(supabase.auth.setSession).mockClear()
    overrideHandler(
      http.post('/api/auth/register', () => HttpResponse.json(MOCK_SESSION, { status: 201 })),
    )
  })

  it('envia {email, password, tenantName} no body do POST', async () => {
    let capturedBody: unknown
    overrideHandler(
      http.post('/api/auth/register', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(MOCK_SESSION, { status: 201 })
      }),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useRegisterMutation(), { wrapper })

    result.current.mutate(VALID_INPUT)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(capturedBody).toMatchObject(VALID_INPUT)
  })

  it('onSuccess: chama setSession, invalida auth/me e navega para /app', async () => {
    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useRegisterMutation(), { wrapper })
    result.current.mutate(VALID_INPUT)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'tok_a',
      refresh_token: 'tok_r',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['auth', 'me'] })
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/app' })
  })

  it('onError: não chama setSession nem navega', async () => {
    overrideHandler(
      http.post('/api/auth/register', () =>
        HttpResponse.json(
          {
            error: {
              code: 'EMAIL_EXISTS_OR_INVALID',
              message: 'Não foi possível criar a conta com este email.',
            },
          },
          { status: 409 },
        ),
      ),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useRegisterMutation(), { wrapper })

    result.current.mutate(VALID_INPUT)
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(supabase.auth.setSession).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
