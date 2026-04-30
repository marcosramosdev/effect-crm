import { Link, createFileRoute } from '@tanstack/react-router'
import { Settings, Plus } from 'lucide-react'
import { PipelineBoard } from '../../../features/pipeline/PipelineBoard'
import { DashboardLayout } from '../../../features/shell/DashboardLayout'
import { useAuth } from '../../../hooks/useAuth'
import type { ViewTab } from '../../../components/ViewTabs'

const VIEW_TABS: ViewTab[] = [
  { label: 'Board', active: true },
  { label: 'List', disabled: true },
  { label: 'Gantt', disabled: true },
  { label: 'Calendar', disabled: true },
  { label: 'Table', disabled: true },
]

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
      viewTabs={VIEW_TABS}
      actions={
        <>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {}}
          >
            <Plus className="h-4 w-4" />
            Adicionar lead
          </button>
          {isOwner && (
            <Link to="/app/pipeline/settings" className="btn btn-ghost btn-sm">
              <Settings className="h-4 w-4" />
              Configurar
            </Link>
          )}
        </>
      }
    >
      <PipelineBoard />
    </DashboardLayout>
  )
}
