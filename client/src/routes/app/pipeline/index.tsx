import { createFileRoute } from '@tanstack/react-router'
import { PipelineBoard } from '../../../features/pipeline/PipelineBoard'
import { DashboardLayout } from '../../../features/shell/DashboardLayout'

export const Route = createFileRoute('/app/pipeline/')({
  component: PipelinePage,
})

function PipelinePage() {
  return (
    <DashboardLayout title="Pipeline" contentClassName="flex-1 overflow-hidden">
      <PipelineBoard />
    </DashboardLayout>
  )
}
