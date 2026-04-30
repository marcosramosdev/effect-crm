import { createFileRoute, redirect } from '@tanstack/react-router'
import { authQueryOptions } from '../../../hooks/useAuth'
import { DashboardLayout } from '../../../features/shell/DashboardLayout'
import { StageSettingsPanel } from '../../../features/pipeline/StageSettingsPanel'
import { CustomFieldSettingsPanel } from '../../../features/pipeline/CustomFieldSettingsPanel'

export const Route = createFileRoute('/app/pipeline/settings')({
  beforeLoad: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authQueryOptions)
    if (auth.role !== 'owner') {
      throw redirect({ to: '/app/pipeline' })
    }
  },
  component: PipelineSettingsPage,
})

function PipelineSettingsPage() {
  return (
    <DashboardLayout title="Configurar Pipeline">
      <div className="p-4 max-w-2xl space-y-8">
        <StageSettingsPanel />
        <CustomFieldSettingsPanel />
      </div>
    </DashboardLayout>
  )
}
