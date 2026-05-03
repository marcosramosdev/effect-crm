import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { Plus, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { PipelineBoard } from '../../../features/pipeline/PipelineBoard'
import { LeadListView } from '../../../features/pipeline/LeadListView'
import { CustomFieldSettingsPanel } from '../../../features/pipeline/CustomFieldSettingsPanel'
import { LeadFormModal } from '../../../features/pipeline/LeadFormModal'
import { useStages } from '../../../features/pipeline/api'
import { DashboardLayout } from '../../../features/shell/DashboardLayout'
import { useAuth } from '../../../hooks/useAuth'
import type { ViewTab } from '../../../components/ViewTabs'

const searchSchema = z.object({
  view: z.enum(['board', 'list']).catch('board'),
})

export const Route = createFileRoute('/app/contacts/')({
  validateSearch: searchSchema,
  component: ContactsPage,
})

function ContactsPage() {
  const { view } = Route.useSearch()
  const navigate = useNavigate({ from: '/app/contacts/' })
  const { data: authData } = useAuth()
  const isOwner = authData?.role === 'owner'
  const [camposOpen, setCamposOpen] = useState(false)
  const [createLeadOpen, setCreateLeadOpen] = useState(false)
  const { data: stagesData } = useStages()
  const stages = stagesData?.stages ?? []
  const sortedStages = [...stages].sort((a, b) => a.order - b.order)
  const firstStageId = sortedStages[0]?.id
  const noStages = stages.length === 0

  const viewTabs: ViewTab[] = [
    { label: 'Board', active: view === 'board' },
    { label: 'List', active: view === 'list' },
  ]

  function handleViewChange(label: string) {
    navigate({ search: { view: label.toLowerCase() as 'board' | 'list' } })
  }

  return (
    <>
      <DashboardLayout
        title="Contatos"
        subtitle="Centralize e organize todos os seus leads em um só lugar"
        contentClassName="flex-1 overflow-hidden"
        viewTabs={viewTabs}
        onViewTabChange={handleViewChange}
        actions={
          <div className="flex items-center gap-2.5">
            {isOwner && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setCamposOpen(true)}
              >
                <Settings2 className="h-4 w-4" />
                Campos
              </button>
            )}
            {noStages ? (
              <span
                className="tooltip tooltip-bottom"
                data-tip="Crie uma etapa antes de adicionar leads"
              >
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setCreateLeadOpen(true)}
                  disabled
                  aria-disabled="true"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar lead
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setCreateLeadOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Adicionar lead
              </button>
            )}
          </div>
        }
      >
        {view === 'list' ? <LeadListView /> : <PipelineBoard />}
      </DashboardLayout>
      {camposOpen && (
        <CustomFieldSettingsPanel
          open={camposOpen}
          onClose={() => setCamposOpen(false)}
        />
      )}
      <LeadFormModal
        open={createLeadOpen}
        mode="create"
        defaultStageId={firstStageId}
        onClose={() => setCreateLeadOpen(false)}
      />
    </>
  )
}
