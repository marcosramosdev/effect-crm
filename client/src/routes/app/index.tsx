import { createFileRoute, redirect } from '@tanstack/react-router'
import { authQueryOptions } from '../../hooks/useAuth'
import { connectionQueryOptions } from '../../features/whatsapp/ConnectScreen'

export const Route = createFileRoute('/app/')({
  beforeLoad: async ({ context }) => {
    const auth = await context.queryClient.ensureQueryData(authQueryOptions)

    if (auth.role !== 'owner') {
      throw redirect({ to: '/app/inbox' })
    }

    const connection = await context.queryClient.ensureQueryData(
      connectionQueryOptions,
    )

    if (connection.status === 'connected') {
      throw redirect({ to: '/app/dashboard' })
    }

    throw redirect({ to: '/app/connect' })
  },
  component: () => null,
})
