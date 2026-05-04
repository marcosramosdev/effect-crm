import { createFileRoute, redirect } from '@tanstack/react-router'
import { authQueryOptions } from '../../hooks/useAuth'
import { instanceStatusQueryOptions } from '../../features/whatsapp/useInstanceStatus'

export const Route = createFileRoute('/app/')({
  beforeLoad: async ({ context }) => {
    const auth = await context.queryClient.ensureQueryData(authQueryOptions)

    if (auth.role !== 'owner') {
      throw redirect({ to: '/app/inbox' })
    }

    const connection = await context.queryClient.ensureQueryData(
      instanceStatusQueryOptions,
    )

    if (connection.status === 'connected') {
      throw redirect({ to: '/app/dashboard' })
    }

    throw redirect({ to: '/app/connect' })
  },
  component: () => null,
})
