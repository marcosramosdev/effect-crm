import { createFileRoute, redirect } from '@tanstack/react-router'
import { authQueryOptions } from '../../hooks/useAuth'

export const Route = createFileRoute('/settings/pipeline')({
  beforeLoad: async ({ context }) => {
    const auth = await context.queryClient.ensureQueryData(authQueryOptions)
    if (auth?.role !== 'owner') {
      throw redirect({ to: '/inbox' })
    }
  },
  component: SettingsPipelinePage,
})

function SettingsPipelinePage() {
  return <div>Pipeline Settings</div>
}
