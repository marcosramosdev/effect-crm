import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, MoreVertical } from 'lucide-react'
import { SortableLeadCard } from './SortableLeadCard'
import { EmptyState } from '../../../components/EmptyState'
import type {
  PipelineLead,
  PipelineStage,
  CustomFieldDef,
} from '@shared/pipeline'

interface DroppableColumnProps {
  stage: PipelineStage
  leads: PipelineLead[]
  customFields: CustomFieldDef[]
  onOpenEdit: (lead: PipelineLead) => void
  onOpenCreate: (stageId: string) => void
}

export function DroppableColumn({
  stage,
  leads,
  customFields,
  onOpenEdit,
  onOpenCreate,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div
      key={stage.id}
      className="flex flex-col w-72 shrink-0 bg-base-200 rounded-lg"
      ref={setNodeRef}
    >
      <div
        className="px-3 py-2 font-semibold border-b border-base-300 border-t-4 rounded-t-lg"
        style={{ borderTopColor: stage.color }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate" title={stage.description ?? undefined}>
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

      <div
        className={`flex flex-col gap-2 p-2 flex-1 min-h-16 ${isOver ? 'bg-base-300/50' : ''}`}
      >
        {leads.length === 0 && (
          <EmptyState
            heading="Sem leads"
            body="Arraste um lead para aqui ou clique em + para criar um novo."
            className="py-8"
          />
        )}
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <SortableLeadCard
              key={lead.id}
              lead={lead}
              customFields={customFields}
              onOpenEdit={onOpenEdit}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
