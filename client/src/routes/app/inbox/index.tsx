import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { Search, Filter } from 'lucide-react'
import { InboxList } from '../../../features/inbox/InboxList'
import { DashboardLayout } from '../../../features/shell/DashboardLayout'

export const Route = createFileRoute('/app/inbox/')({
  component: InboxLayout,
})

function InboxLayout() {
  const navigate = useNavigate()
  return (
    <DashboardLayout
      title="Caixa de entrada"
      subtitle="Conversas do WhatsApp em tempo real"
      contentClassName="flex flex-1 overflow-hidden bg-base-200/50"
    >
      <aside className="w-[22rem] shrink-0 border-r border-base-200 bg-base-100 overflow-hidden flex flex-col">
        <div className="px-3 pt-3 pb-2 border-b border-base-200/80 flex items-center gap-2">
          <label className="flex-1 flex items-center gap-2 h-9 px-3 rounded-full bg-base-200/70 border border-transparent focus-within:border-base-content/15 focus-within:bg-base-100 transition-colors">
            <Search className="h-4 w-4 text-base-content/45" />
            <input
              type="search"
              placeholder="Buscar conversa…"
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-base-content/45"
            />
          </label>
          <button
            type="button"
            aria-label="Filtros"
            className="btn btn-ghost btn-sm btn-square text-base-content/55"
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <InboxList
            onSelect={(id) =>
              navigate({
                to: '/app/inbox/$conversationId',
                params: { conversationId: id },
              })
            }
          />
        </div>
      </aside>
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </DashboardLayout>
  )
}
