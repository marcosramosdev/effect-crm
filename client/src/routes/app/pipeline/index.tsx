import { Link, createFileRoute } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { PipelineBoard } from '../../../features/pipeline/PipelineBoard'
import { DashboardLayout } from '../../../features/shell/DashboardLayout'
import { useAuth } from '../../../hooks/useAuth'

export const Route = createFileRoute('/app/pipeline/')({
  component: PipelinePage,
})

function PipelinePage() {
  const { data: auth } = useAuth()
  const isOwner = auth?.role === 'owner'

  return (
    <DashboardLayout
      title="Pipeline"
      contentClassName="flex-1 overflow-hidden"
      actions={
        isOwner ? (
          <Link to="/app/pipeline/settings" className="btn btn-ghost btn-sm">
            <Settings className="h-4 w-4" />
            Configurar
          </Link>
        ) : null
      }
    >
      <PipelineBoard />
    </DashboardLayout>
  )
}
