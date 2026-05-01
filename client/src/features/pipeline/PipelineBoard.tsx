import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useStages, useLeads, useMoveLead, useStageMutations } from './api'
import { useAuth } from '../../hooks/useAuth'
import { LeadFormModal } from './LeadFormModal'
import { DroppableColumn } from './dnd/DroppableColumn'
import { SortableLeadCard } from './dnd/SortableLeadCard'
import type { PipelineLead } from '@shared/pipeline'

interface ModalState {
  open: boolean
  mode: 'create' | 'edit'
  stageId?: string
  lead?: PipelineLead
}

export function PipelineBoard() {
  const { data: stagesData, isLoading: stagesLoading } = useStages()
  const { data: leadsData, isLoading: leadsLoading } = useLeads()
  const { data: auth } = useAuth()
  const moveMutation = useMoveLead()
  const { createStage, reorderStages } = useStageMutations()

  const isOwner = auth?.role === 'owner'

  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: 'create',
  })
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null)
  const [optimisticLeads, setOptimisticLeads] = useState<PipelineLead[] | null>(
    null,
  )
  const [addingStage, setAddingStage] = useState(false)
  const [newStageName, setNewStageName] = useState('')

  const stages = stagesData?.stages ?? []
  const leads = optimisticLeads ?? leadsData?.leads ?? []

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (event.active.data.current?.type === 'column') return
    setActiveLeadId(event.active.id as string)
  }, [])

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (active.data.current?.type === 'column') return
      if (!over) return

      const activeId = active.id as string
      const overId = over.id as string

      const activeLead = leads.find((l) => l.id === activeId)
      if (!activeLead) return

      const overStage = stages.find((s) => s.id === overId)
      const overLead = leads.find((l) => l.id === overId)

      const targetStageId = overStage ? overStage.id : overLead?.stageId
      if (!targetStageId || targetStageId === activeLead.stageId) return

      setOptimisticLeads((prev) => {
        const current = prev ?? leads
        return current.map((l) =>
          l.id === activeId ? { ...l, stageId: targetStageId } : l,
        )
      })
    },
    [leads, stages],
  )

  const computePosition = useCallback(
    (stageId: string, overId: string | null): number => {
      const stageLeads = leads
        .filter((l) => l.stageId === stageId && l.id !== activeLeadId)
        .sort((a, b) => a.position - b.position)

      if (stageLeads.length === 0) return 1024

      const overIndex = stageLeads.findIndex((l) => l.id === overId)

      if (overIndex === -1) {
        const maxPos = stageLeads[stageLeads.length - 1]?.position ?? 0
        return maxPos + 1024
      }

      const leftPos = overIndex > 0 ? stageLeads[overIndex - 1].position : 0
      const rightPos = stageLeads[overIndex]?.position ?? leftPos + 2048

      if (leftPos === 0) return rightPos - 1024
      return Math.floor((leftPos + rightPos) / 2)
    },
    [leads, activeLeadId],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      // Column reorder
      if (active.data.current?.type === 'column') {
        if (!over) return
        const activeStageId = active.data.current.id as string
        const overStageId = over.id as string
        const fromIndex = stages.findIndex((s) => s.id === activeStageId)
        const toIndex = stages.findIndex((s) => s.id === overStageId)
        if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
          const reordered = arrayMove([...stages], fromIndex, toIndex)
          reorderStages.mutate({
            stages: reordered.map((s, i) => ({ id: s.id, order: i + 1 })),
          })
        }
        return
      }

      // Lead move
      setActiveLeadId(null)

      if (!over) {
        setOptimisticLeads(null)
        return
      }

      const activeId = active.id as string
      const overId = over.id as string

      const activeLead = leads.find((l) => l.id === activeId)
      if (!activeLead) {
        setOptimisticLeads(null)
        return
      }

      const overStage = stages.find((s) => s.id === overId)
      const overLead = leads.find((l) => l.id === overId)

      const targetStageId = overStage ? overStage.id : overLead?.stageId
      if (!targetStageId) {
        setOptimisticLeads(null)
        return
      }

      const position = computePosition(targetStageId, overLead?.id ?? null)

      if (
        activeLead.stageId !== targetStageId ||
        activeLead.position !== position
      ) {
        moveMutation.mutate({
          leadId: activeId,
          stageId: targetStageId,
          position,
        })
      }

      setOptimisticLeads(null)
    },
    [leads, stages, moveMutation, computePosition, reorderStages],
  )

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

  const openCreateModal = (stageId: string) => {
    setModal({ open: true, mode: 'create', stageId })
  }

  const openEditModal = (lead: PipelineLead) => {
    setModal({ open: true, mode: 'edit', lead })
  }

  if (stagesLoading || leadsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="loading loading-spinner loading-md" />
      </div>
    )
  }

  const activeLead = activeLeadId
    ? leads.find((l) => l.id === activeLeadId)
    : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="board-scroll flex gap-4 p-4 overflow-x-auto scroll-smooth [scroll-snap-type:x_proximity] [overscroll-behavior-x:contain] h-full">
        {stages.map((stage) => {
          const stageLeads = leads
            .filter((l) => l.stageId === stage.id)
            .sort((a, b) => a.position - b.position)
          return (
            <DroppableColumn
              key={stage.id}
              stage={stage}
              stages={stages}
              leads={stageLeads}
              isOwner={isOwner}
              onOpenEdit={openEditModal}
              onOpenCreate={openCreateModal}
            />
          )
        })}

        {/* Add stage ghost column (owner only) */}
        {isOwner && (
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
                <span className="text-sm font-medium">Adicionar etapa</span>
              </button>
            )}
          </div>
        )}
      </div>

      <DragOverlay>
        {activeLead ? (
          <div className="w-72">
            <SortableLeadCard
              lead={activeLead}
              stage={stages.find((s) => s.id === activeLead.stageId)}
              onOpenEdit={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>

      <LeadFormModal
        open={modal.open}
        mode={modal.mode}
        stageId={modal.stageId}
        lead={modal.lead}
        onClose={() => setModal({ open: false, mode: 'create' })}
      />
    </DndContext>
  )
}
