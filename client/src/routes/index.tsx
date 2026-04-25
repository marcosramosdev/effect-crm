import { createFileRoute, redirect } from '@tanstack/react-router'
import { authQueryOptions } from '../hooks/useAuth'
import { connectionQueryOptions } from '../features/whatsapp/ConnectScreen'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const auth = await context.queryClient.ensureQueryData(authQueryOptions)

    if (auth.role !== 'owner') {
      throw redirect({ to: '/inbox' })
    }

    const connection = await context.queryClient.ensureQueryData(
      connectionQueryOptions,
    )

    if (connection.status === 'connected') {
      throw redirect({ to: '/inbox' })
    }

    throw redirect({ to: '/connect' })
  },
  component: () => null,
})
