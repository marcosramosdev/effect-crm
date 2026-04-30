import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { apiFetch } from '../../lib/api'
import { supabase } from '../../lib/supabase'

export function useLogoutMutation() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  async function cleanup() {
    await supabase.auth.signOut({ scope: 'local' })
    queryClient.clear()
    navigate({ to: '/' })
  }

  return useMutation({
    mutationFn: () => apiFetch('/auth/logout', { method: 'POST' }),
    onSuccess: () => cleanup(),
    onError: () => cleanup(),
  })
}
