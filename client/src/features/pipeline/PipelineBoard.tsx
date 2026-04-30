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
import { useStages, useLeads, useMoveLead } from './api'
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
  const moveMutation = useMoveLead()

  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: 'create',
  })
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null)
  const [optimisticLeads, setOptimisticLeads] = useState<PipelineLead[] | null>(
    null,
  )

  const stages = stagesData?.stages ?? []
  const leads = optimisticLeads ?? leadsData?.leads ?? []

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveLeadId(event.active.id as string)
  }, [])

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
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
    [leads, stages, moveMutation, computePosition],
  )

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
      <div className="flex gap-4 p-4 overflow-x-auto h-full">
        {stages.map((stage) => {
          const stageLeads = leads
            .filter((l) => l.stageId === stage.id)
            .sort((a, b) => a.position - b.position)
          return (
            <DroppableColumn
              key={stage.id}
              stage={stage}
              leads={stageLeads}
              onOpenEdit={openEditModal}
              onOpenCreate={openCreateModal}
            />
          )
        })}
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
