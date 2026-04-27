import { createFileRoute, redirect } from '@tanstack/react-router'
import { authQueryOptions } from '../../hooks/useAuth'
import { ConnectScreen } from '../../features/whatsapp/ConnectScreen'

export const Route = createFileRoute('/app/connect')({
  beforeLoad: async ({ context }) => {
    const auth = await context.queryClient.ensureQueryData(authQueryOptions)
    if (auth.role !== 'owner') {
      throw redirect({ to: '/app/inbox' })
    }
  },
  component: ConnectScreen,
})
