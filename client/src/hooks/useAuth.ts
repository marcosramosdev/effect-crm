import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

type AuthUser = {
  userId: string
  email: string
  tenantId: string
  tenantName: string
  role: 'owner' | 'agent'
}

export const authQueryOptions = {
  queryKey: ['auth', 'me'] as const,
  queryFn: (): Promise<AuthUser> => apiFetch('/auth/me'),
  staleTime: 5 * 60 * 1000,
}

export function useAuth() {
  return useQuery(authQueryOptions)
}
