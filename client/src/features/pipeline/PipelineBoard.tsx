import { useState, useRef, useCallback } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import { Plus, MoreVertical, GripVertical } from 'lucide-react'
import { useStages, useLeads, useCustomFields, useMoveLead } from './api'
import { LeadFormModal } from './LeadFormModal'
import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
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
  const { data: customFieldsData } = useCustomFields()
  const moveMutation = useMoveLead()

  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: 'create',
  })
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const stages = stagesData?.stages ?? []
  const leads = leadsData?.leads ?? []
  const customFields = customFieldsData?.fields ?? []

  const handleDragEnd = useCallback(
    (
      _event: MouseEvent | TouchEvent | PointerEvent,
      info: { point: { x: number; y: number } },
      leadId: string,
    ) => {
      const pointerX = info.point.x
      const pointerY = info.point.y

      for (const stage of stages) {
        const el = columnRefs.current[stage.id]
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (
          pointerX >= rect.left &&
          pointerX <= rect.right &&
          pointerY >= rect.top &&
          pointerY <= rect.bottom
        ) {
          const lead = leads.find((l) => l.id === leadId)
          if (lead && lead.stageId !== stage.id) {
            moveMutation.mutate({ leadId, stageId: stage.id })
          }
          break
        }
      }
    },
    [stages, leads, moveMutation],
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

  return (
    <LayoutGroup>
      <div className="flex gap-4 p-4 overflow-x-auto h-full">
        {stages.map((stage) => {
          const stageLeads = leads.filter((l) => l.stageId === stage.id)
          return (
            <motion.div
              key={stage.id}
              layout
              className="flex flex-col w-72 shrink-0 bg-base-200 rounded-lg"
              ref={(el) => {
                columnRefs.current[stage.id] = el
              }}
            >
              {/* Column header */}
              <div
                className="px-3 py-2 font-semibold border-b border-base-300 border-t-4 rounded-t-lg"
                style={{ borderTopColor: stage.color }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="truncate"
                      title={stage.description ?? undefined}
                    >
                      {stage.name}
                    </span>
                    <span className="badge badge-sm badge-ghost shrink-0">
                      {stageLeads.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-square"
                      onClick={() => openCreateModal(stage.id)}
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

              {/* Leads list */}
              <div className="flex flex-col gap-2 p-2 flex-1 min-h-16">
                {stageLeads.length === 0 && (
                  <EmptyState
                    heading="Sem leads"
                    body="Arraste um lead para aqui ou clique em + para criar um novo."
                    className="py-8"
                  />
                )}
                {stageLeads.map((lead) => (
                  <motion.div
                    key={lead.id}
                    layoutId={lead.id}
                    layout="position"
                    drag
                    dragSnapToOrigin
                    onDragEnd={(event, info) =>
                      handleDragEnd(event, info, lead.id)
                    }
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <Card
                      as="div"
                      className="p-3 hover:shadow-md transition-shadow"
                      onClick={() => openEditModal(lead)}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-base-content/40 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">
                            {lead.displayName ?? formatPhone(lead.phoneNumber)}
                          </div>
                          <div className="text-xs text-base-content/60 truncate">
                            {formatPhone(lead.phoneNumber)}
                          </div>
                          {lead.customValues &&
                            Object.keys(lead.customValues).length > 0 &&
                            customFields.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {Object.entries(lead.customValues)
                                  .filter(([, v]) => v !== null)
                                  .slice(0, 3)
                                  .map(([fieldId, value]) => {
                                    const field = customFields.find(
                                      (f) => f.id === fieldId,
                                    )
                                    if (!field) return null
                                    return (
                                      <span
                                        key={fieldId}
                                        className="badge badge-xs badge-ghost"
                                        title={`${field.label}: ${value}`}
                                      >
                                        {field.label}: {value}
                                      </span>
                                    )
                                  })}
                              </div>
                            )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )
        })}
      </div>

      <LeadFormModal
        open={modal.open}
        mode={modal.mode}
        stageId={modal.stageId}
        lead={modal.lead}
        onClose={() => setModal({ open: false, mode: 'create' })}
      />
    </LayoutGroup>
  )
}

function formatPhone(phone: string): string {
  if (phone.startsWith('manual:')) return '—'
  return phone
}
