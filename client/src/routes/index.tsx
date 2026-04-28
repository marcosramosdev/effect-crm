import { createFileRoute, isRedirect, redirect } from '@tanstack/react-router'
import { HomePage } from '../features/auth/HomePage'
import { authQueryOptions } from '../hooks/useAuth'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(authQueryOptions)
      throw redirect({ to: '/app' })
    } catch (e) {
      if (isRedirect(e)) throw e
    }
  },
  component: HomePage,
})
