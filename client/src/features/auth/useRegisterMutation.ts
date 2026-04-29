import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { apiFetch } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { authQueryOptions } from '../../hooks/useAuth'
import type { RegisterRequest } from '@shared/auth'
import { AuthSessionSchema } from '@shared/auth'

export function useRegisterMutation() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (input: RegisterRequest) =>
      apiFetch(
        '/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
        AuthSessionSchema,
      ),
    onSuccess: async (session) => {
      const { error } = await supabase.auth.setSession({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
      })
      if (error) throw error

      await queryClient.fetchQuery({
        ...authQueryOptions,
        queryFn: () =>
          apiFetch('/auth/me', undefined, undefined, session.accessToken),
      })

      navigate({ to: '/app' })
    },
  })
}
