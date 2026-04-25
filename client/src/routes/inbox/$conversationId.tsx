import { createFileRoute, Link } from '@tanstack/react-router'
import { ConversationView } from '../../features/inbox/ConversationView'

export const Route = createFileRoute('/inbox/$conversationId')({
  component: ConversationPage,
})

function ConversationPage() {
  const { conversationId } = Route.useParams()
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-base-200 flex items-center gap-3 md:hidden">
        <Link to="/inbox" className="btn btn-ghost btn-sm">
          ← Back
        </Link>
      </div>
      <div className="flex-1 overflow-hidden">
        <ConversationView conversationId={conversationId} />
      </div>
    </div>
  )
}
