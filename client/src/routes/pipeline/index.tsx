import { createFileRoute } from '@tanstack/react-router'
import { PipelineBoard } from '../../features/pipeline/PipelineBoard'

export const Route = createFileRoute('/pipeline/')({
  component: PipelinePage,
})

function PipelinePage() {
  return (
    <div className="h-screen flex flex-col">
      <div className="px-4 py-3 border-b border-base-200">
        <h1 className="text-lg font-semibold">Pipeline</h1>
      </div>
      <div className="flex-1 overflow-auto">
        <PipelineBoard />
      </div>
    </div>
  )
}
