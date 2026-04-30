import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, MoreVertical, Inbox } from 'lucide-react'
import { SortableLeadCard } from './SortableLeadCard'
import type { PipelineLead, PipelineStage } from '@shared/pipeline'

interface DroppableColumnProps {
  stage: PipelineStage
  leads: PipelineLead[]
  onOpenEdit: (lead: PipelineLead) => void
  onOpenCreate: (stageId: string) => void
}

export function DroppableColumn({
  stage,
  leads,
  onOpenEdit,
  onOpenCreate,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div
      key={stage.id}
      className="flex flex-col w-72 shrink-0 bg-base-200 rounded-lg max-h-full"
      ref={setNodeRef}
    >
      {/* Column header — sticky */}
      <div
        className="px-3 py-2 font-semibold border-b border-base-300 border-t-4 rounded-t-lg sticky top-0 z-10 bg-base-200"
        style={{ borderTopColor: stage.color }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {/* Stage tag chip */}
            <span
              className="badge badge-sm gap-1 shrink-0"
              style={{
                backgroundColor: stage.color + '18',
                borderColor: stage.color,
                color: stage.color,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              {stage.name}
            </span>
            <span className="badge badge-sm badge-ghost shrink-0">
              {leads.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square"
              onClick={() => onOpenCreate(stage.id)}
              aria-label={`Adicionar lead em ${stage.name}`}
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square"
              aria-label={`Opções de ${stage.name}`}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>
        {stage.description && (
          <p className="text-xs text-base-content/60 mt-1 truncate">
            {stage.description}
          </p>
        )}
      </div>

      {/* Column body — scrollable */}
      <div
        className={`flex flex-col gap-2 p-2 flex-1 overflow-y-auto min-h-0 ${isOver ? 'bg-base-300/50' : ''}`}
      >
        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <Inbox className="h-10 w-10 text-base-content/30" />
            <p className="text-sm font-medium text-base-content/70">
              Sem leads nesta etapa
            </p>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => onOpenCreate(stage.id)}
            >
              Criar lead
            </button>
          </div>
        )}
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <SortableLeadCard
              key={lead.id}
              lead={lead}
              stage={stage}
              onOpenEdit={onOpenEdit}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
