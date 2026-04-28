import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { InboxList } from '../../../features/inbox/InboxList'

export const Route = createFileRoute('/app/inbox/')({
  component: InboxLayout,
})

function InboxLayout() {
  const navigate = useNavigate()
  return (
    <div className="flex h-screen">
      <div className="w-80 shrink-0 border-r border-base-200 overflow-y-auto flex flex-col">
        <div className="px-4 py-3 border-b border-base-200">
          <h1 className="text-lg font-semibold">Inbox</h1>
        </div>
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
    </div>
  )
}
