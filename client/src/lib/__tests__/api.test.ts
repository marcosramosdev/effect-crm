import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { overrideHandler } from '../../test/msw/server'
import { supabase } from '../supabase'
import { apiFetch } from '../api'

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
      signOut: vi.fn(),
    },
  },
}))

describe('apiFetch', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.signOut).mockReset()
  })

  it('on 401: calls signOut({ scope: "local" }) and throws Unauthorized', async () => {
    overrideHandler(
      http.get('/api/test-401', () => new HttpResponse(null, { status: 401 })),
    )

    await expect(apiFetch('/test-401')).rejects.toThrow('Unauthorized')
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
  })
})
