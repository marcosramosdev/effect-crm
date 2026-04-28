import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { apiFetch } from '../../lib/api'
import { supabase } from '../../lib/supabase'
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
      await supabase.auth.setSession({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
      })
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      navigate({ to: '/app' })
    },
  })
}
