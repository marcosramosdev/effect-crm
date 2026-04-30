import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { InboxList } from '../../../features/inbox/InboxList'
import { DashboardLayout } from '../../../features/shell/DashboardLayout'

export const Route = createFileRoute('/app/inbox/')({
  component: InboxLayout,
})

function InboxLayout() {
  const navigate = useNavigate()
  return (
    <DashboardLayout
      title="Inbox"
      contentClassName="flex flex-1 overflow-hidden"
    >
      <div className="w-80 shrink-0 border-r border-base-200 overflow-y-auto flex flex-col">
        <InboxList
          onSelect={(id) =>
            navigate({
              to: '/app/inbox/$conversationId',
              params: { conversationId: id },
            })
          }
        />
      </div>
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </DashboardLayout>
  )
}
