import { useState, useRef, useEffect } from 'react'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, Inbox, GripVertical } from 'lucide-react'
import { SortableLeadCard } from './SortableLeadCard'
import { StageColumnMenu } from '../StageColumnMenu'
import { useStageMutations } from '../api'
import type { PipelineLead, PipelineStage } from '@shared/pipeline'

interface DroppableColumnProps {
  stage: PipelineStage
  stages: PipelineStage[]
  leads: PipelineLead[]
  isOwner: boolean
  onOpenEdit: (lead: PipelineLead) => void
  onOpenCreate: (stageId: string) => void
}

export function DroppableColumn({
  stage,
  stages,
  leads,
  isOwner,
  onOpenEdit,
  onOpenCreate,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  const {
    attributes: dragAttrs,
    listeners: dragListeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `column-${stage.id}`,
    data: { type: 'column', id: stage.id },
    disabled: !isOwner,
  })

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(stage.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const { updateStage } = useStageMutations()

  useEffect(() => {
    if (isEditing) inputRef.current?.select()
  }, [isEditing])

  function startRename() {
    setEditName(stage.name)
    setIsEditing(true)
  }

  function commitRename() {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== stage.name) {
      updateStage.mutate({ stageId: stage.id, body: { name: trimmed } })
    }
    setIsEditing(false)
  }

  function handleRenameKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') {
      setEditName(stage.name)
      setIsEditing(false)
    }
  }

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      key={stage.id}
      className="flex flex-col w-72 shrink-0 bg-base-200 rounded-lg min-h-full max-h-full [scroll-snap-align:start]"
      ref={setNodeRef}
      style={{ ...style, opacity: isDragging ? 0.5 : 1 }}
    >
      {/* Column header */}
      <div
        className="px-3 py-2 font-semibold border-b border-base-300 border-t-4 rounded-t-lg sticky top-0 z-10 bg-base-200"
        style={{ borderTopColor: stage.color }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isOwner && (
              <div
                ref={setDragRef}
                {...dragAttrs}
                {...dragListeners}
                className="cursor-grab active:cursor-grabbing text-base-content/40 hover:text-base-content/70 shrink-0"
                aria-label="Reordenar etapa"
              >
                <GripVertical className="h-4 w-4" />
              </div>
            )}

            {/* Stage chip / inline rename */}
            {isEditing ? (
              <input
                ref={inputRef}
                className="input input-xs input-bordered flex-1 min-w-0"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={handleRenameKey}
                aria-label="Renomear etapa"
              />
            ) : (
              <span
                className="badge badge-sm gap-1 shrink-0 cursor-default"
                style={{
                  backgroundColor: stage.color + '18',
                  borderColor: stage.color,
                  color: stage.color,
                }}
                onDoubleClick={isOwner ? startRename : undefined}
                title={isOwner ? 'Duplo clique para renomear' : undefined}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                {stage.name}
              </span>
            )}

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
            {isOwner && (
              <StageColumnMenu
                stage={stage}
                stages={stages}
                onRename={startRename}
              />
            )}
          </div>
        </div>
        {stage.description && (
          <p className="text-xs text-base-content/60 mt-1 truncate">
            {stage.description}
          </p>
        )}
      </div>

      {/* Column body */}
      <div
        className={`flex flex-col gap-2 p-2 flex-1 overflow-y-auto min-h-16 ${isOver ? 'bg-base-300/50' : ''}`}
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
