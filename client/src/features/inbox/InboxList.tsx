import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Inbox } from 'lucide-react'
import { apiFetch } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { EmptyState } from '../../components/EmptyState'
import type {
  ConversationSummary,
  ConversationListResponse,
} from '@shared/inbox'

export const conversationsQueryOptions = {
  queryKey: ['inbox', 'conversations'] as const,
  queryFn: (): Promise<ConversationListResponse> =>
    apiFetch('/inbox/conversations'),
}

interface InboxListProps {
  onSelect?: (conversationId: string) => void
}

function getInitials(name: string): string {
  const parts = name.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'agora'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

export function InboxList({ onSelect }: InboxListProps) {
  const queryClient = useQueryClient()
  const { data: auth } = useAuth()
  const { data, isLoading } = useQuery(conversationsQueryOptions)

  const markReadMutation = useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch<{ conversationId: string; unreadCount: 0 }>(
        `/inbox/conversations/${conversationId}/read`,
        { method: 'POST' },
      ),
    onSuccess: (result) => {
      queryClient.setQueryData(
        conversationsQueryOptions.queryKey,
        (old: ConversationListResponse | undefined) => {
          if (!old) return old
          return {
            ...old,
            conversations: old.conversations.map((c) =>
              c.id === result.conversationId ? { ...c, unreadCount: 0 } : c,
            ),
          }
        },
      )
    },
  })

  useEffect(() => {
    if (!auth?.tenantId) return

    const channel = supabase
      .channel('inbox-conversations')

      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `tenant_id=eq.${auth.tenantId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          queryClient.setQueryData(
            conversationsQueryOptions.queryKey,
            (old: ConversationListResponse | undefined) => {
              if (!old) return old

              const updatedId = payload.new.id as string
              const exists = old.conversations.some((c) => c.id === updatedId)

              if (!exists) {
                queryClient.invalidateQueries({
                  queryKey: conversationsQueryOptions.queryKey,
                })
                return old
              }

              const conversations = old.conversations
                .map((c): ConversationSummary => {
                  if (c.id !== updatedId) return c
                  return {
                    ...c,
                    lastMessageAt:
                      (payload.new.last_message_at as string | undefined) ??
                      c.lastMessageAt,
                    unreadCount:
                      (payload.new.unread_count as number | undefined) ??
                      c.unreadCount,
                    lastMessagePreview:
                      (payload.new.last_message_preview as
                        | string
                        | undefined) ?? c.lastMessagePreview,
                  }
                })
                .sort(
                  (a, b) =>
                    new Date(b.lastMessageAt).getTime() -
                    new Date(a.lastMessageAt).getTime(),
                )

              return { ...old, conversations }
            },
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [auth?.tenantId, queryClient])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-3" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="skeleton-shimmer h-16 rounded-xl"
            aria-hidden="true"
          />
        ))}
      </div>
    )
  }

  const conversations = data?.conversations ?? []

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<Inbox />}
        heading="Sem conversas por aqui"
        body="Quando alguém mandar mensagem no WhatsApp da empresa, ela aparece aqui em tempo real."
      />
    )
  }

  return (
    <ul className="flex flex-col p-2 gap-1">
      {conversations.map((conversation) => {
        const name =
          conversation.leadDisplayName ?? conversation.leadPhoneNumber
        const initials = getInitials(name ?? '?')
        const time = formatRelativeTime(conversation.lastMessageAt)
        const isUnread = conversation.unreadCount > 0
        const handleSelect = () => {
          markReadMutation.mutate(conversation.id)
          onSelect?.(conversation.id)
        }
        return (
          <li
            key={conversation.id}
            tabIndex={0}
            onClick={handleSelect}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleSelect()
              }
            }}
            className="cursor-pointer flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-base-200/70 focus-visible:bg-base-200 transition-colors"
          >
              <span className="relative shrink-0">
                <span className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 text-base-content/80 font-semibold text-sm flex items-center justify-center">
                  {initials}
                </span>
                {isUnread && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-base-100" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`truncate text-sm ${isUnread ? 'font-semibold text-base-content' : 'font-medium text-base-content/85'}`}
                  >
                    {name}
                  </span>
                  <span className="ml-auto text-[11px] text-base-content/45 tabular-nums shrink-0">
                    {time}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p
                    className={`truncate text-[13px] flex-1 ${isUnread ? 'text-base-content/80' : 'text-base-content/55'}`}
                  >
                    {conversation.lastMessagePreview}
                  </p>
                  {isUnread && (
                    <span className="shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-primary-content text-[11px] font-semibold tabular-nums">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
              </div>
          </li>
        )
      })}
    </ul>
  )
}
