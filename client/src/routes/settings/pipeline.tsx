import { createFileRoute, redirect } from '@tanstack/react-router'
import { authQueryOptions } from '../../hooks/useAuth'
import { StageSettings } from '../../features/pipeline/StageSettings'

export const Route = createFileRoute('/settings/pipeline')({
  beforeLoad: async ({ context }) => {
    const auth = await context.queryClient.ensureQueryData(authQueryOptions)
    if (auth.role !== 'owner') {
      throw redirect({ to: '/inbox' })
    }
  },
  component: SettingsPipelinePage,
})

function SettingsPipelinePage() {
  return (
    <div className="h-screen flex flex-col">
      <div className="px-4 py-3 border-b border-base-200">
        <h1 className="text-lg font-semibold">Configurar Pipeline</h1>
      </div>
      <div className="flex-1 overflow-auto">
        <StageSettings />
      </div>
    </div>
  )
}
