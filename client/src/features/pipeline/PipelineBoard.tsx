import { useState, useRef, useEffect } from 'react'
import { Plus, Inbox } from 'lucide-react'
import { useStages, useLeads, useMoveLead, useStageMutations } from './api'
import { useAuth } from '../../hooks/useAuth'
import { LeadFormModal } from './LeadFormModal'
import { PipelineBoardDnd } from './dnd-pangea/PipelineBoardDnd'
import { PipelineCard } from './PipelineCard'
import { StageColumnMenu } from './StageColumnMenu'
import type { DraggableProvided } from '@hello-pangea/dnd'
import type { PipelineLead, PipelineStage } from '@shared/pipeline'

interface ModalState {
  open: boolean
  mode: 'create' | 'edit'
  stageId?: string
  lead?: PipelineLead
}

function StageColumnHeader({
  stage,
  stages,
  leadCount,
  isOwner,
  onOpenCreate,
}: {
  stage: PipelineStage
  stages: PipelineStage[]
  leadCount: number
  isOwner: boolean
  onOpenCreate: (stageId: string) => void
}) {
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

  return (
    <div
      className="px-3 py-2 font-semibold border-b border-base-300 border-t-4 rounded-t-lg sticky top-0 z-10 bg-white"
      style={{ borderTopColor: stage.color }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
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
            {leadCount}
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
  )
}

export function PipelineBoard() {
  const { data: stagesData, isLoading: stagesLoading } = useStages()
  const { data: leadsData, isLoading: leadsLoading } = useLeads()
  const { data: auth } = useAuth()
  const moveMutation = useMoveLead()
  const { createStage } = useStageMutations()

  const isOwner = auth?.role === 'owner'

  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: 'create',
  })
  const [addingStage, setAddingStage] = useState(false)
  const [newStageName, setNewStageName] = useState('')

  const stages = stagesData?.stages ?? []
  const leads = leadsData?.leads ?? []

  function handleMove(leadId: string, targetStageId: string, position: number) {
    moveMutation.mutate({ leadId, stageId: targetStageId, position })
  }

  function handleAddStage(e: React.FormEvent) {
    e.preventDefault()
    const name = newStageName.trim()
    if (!name) return
    createStage.mutate(name, {
      onSuccess: () => {
        setAddingStage(false)
        setNewStageName('')
      },
    })
  }

  const openCreateModal = (stageId: string) =>
    setModal({ open: true, mode: 'create', stageId })

  const openEditModal = (lead: PipelineLead) =>
    setModal({ open: true, mode: 'edit', lead })

  if (stagesLoading || leadsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="loading loading-spinner loading-md" />
      </div>
    )
  }

  return (
    <>
      <PipelineBoardDnd
        stages={stages}
        leads={leads}
        onMove={handleMove}
        renderColumnHeader={(stage, stageLeads) => (
          <StageColumnHeader
            stage={stage}
            stages={stages}
            leadCount={stageLeads.length}
            isOwner={isOwner}
            onOpenCreate={openCreateModal}
          />
        )}
        renderCard={(
          lead: PipelineLead,
          provided: DraggableProvided,
          isDragging: boolean,
        ) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            style={{
              ...provided.draggableProps.style,
              opacity: isDragging ? 0.5 : 1,
            }}
            className="cursor-grab active:cursor-grabbing"
          >
            <PipelineCard
              lead={lead}
              stage={stages.find((s) => s.id === lead.stageId)}
              onClick={() => openEditModal(lead)}
            />
          </div>
        )}
        renderEmptyColumn={(stage) => (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <Inbox className="h-10 w-10 text-base-content/30" />
            <p className="text-sm font-medium text-base-content/70">
              Sem leads nesta etapa
            </p>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => openCreateModal(stage.id)}
            >
              Criar lead
            </button>
          </div>
        )}
        renderBoardFooter={
          isOwner
            ? () => (
                <div className="flex flex-col w-72 shrink-0 min-h-full [scroll-snap-align:start]">
                  {addingStage ? (
                    <form
                      onSubmit={handleAddStage}
                      className="flex flex-col gap-2 p-3 bg-base-200 rounded-lg border-2 border-dashed border-base-300"
                    >
                      <input
                        autoFocus
                        className="input input-sm input-bordered w-full"
                        placeholder="Nome da etapa..."
                        value={newStageName}
                        onChange={(e) => setNewStageName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setAddingStage(false)
                            setNewStageName('')
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="btn btn-sm btn-primary flex-1"
                          disabled={createStage.isPending}
                        >
                          Criar
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => {
                            setAddingStage(false)
                            setNewStageName('')
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      aria-label="Adicionar etapa"
                      className="flex items-center justify-center gap-2 h-full min-h-32 rounded-lg border-2 border-dashed border-base-300 text-base-content/40 hover:border-primary/50 hover:text-primary/70 transition-colors"
                      onClick={() => setAddingStage(true)}
                    >
                      <Plus className="h-5 w-5" />
                      <span className="text-sm font-medium">
                        Adicionar etapa
                      </span>
                    </button>
                  )}
                </div>
              )
            : undefined
        }
      />
      <LeadFormModal
        open={modal.open}
        mode={modal.mode}
        stageId={modal.stageId}
        lead={modal.lead}
        onClose={() => setModal({ open: false, mode: 'create' })}
      />
    </>
  )
}
