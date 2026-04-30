import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { PipelineBoard } from '../../../features/pipeline/PipelineBoard'
import { LeadListView } from '../../../features/pipeline/LeadListView'
import { DashboardLayout } from '../../../features/shell/DashboardLayout'
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

  const viewTabs: ViewTab[] = [
    { label: 'Board', active: view === 'board' },
    { label: 'List', active: view === 'list' },
  ]

  function handleViewChange(label: string) {
    navigate({ search: { view: label.toLowerCase() as 'board' | 'list' } })
  }

  return (
    <DashboardLayout
      title="Contatos"
      subtitle="Centralize e organize todos os seus leads em um só lugar"
      contentClassName="flex-1 overflow-hidden"
      viewTabs={viewTabs}
      onViewTabChange={handleViewChange}
      actions={
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => {}}
        >
          <Plus className="h-4 w-4" />
          Adicionar lead
        </button>
      }
    >
      {view === 'list' ? <LeadListView /> : <PipelineBoard />}
    </DashboardLayout>
  )
}
