import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { ConversationView } from '../../../features/inbox/ConversationView'

export const Route = createFileRoute('/app/inbox/$conversationId')({
  component: ConversationPage,
})

function ConversationPage() {
  const { conversationId } = Route.useParams()
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-base-200 flex items-center gap-2 md:hidden bg-base-100">
        <Link
          to="/app/inbox"
          className="btn btn-ghost btn-sm gap-1 rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </div>
      <div className="flex-1 overflow-hidden">
        <ConversationView conversationId={conversationId} />
      </div>
    </div>
  )
}
