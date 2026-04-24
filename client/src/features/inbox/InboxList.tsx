import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiFetch } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { ConversationSummary, ConversationListResponse } from '@shared/inbox'

export const conversationsQueryOptions = {
  queryKey: ['inbox', 'conversations'] as const,
  queryFn: (): Promise<ConversationListResponse> => apiFetch('/inbox/conversations'),
}

interface InboxListProps {
  onSelect?: (conversationId: string) => void
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `tenant_id=eq.${auth.tenantId}`,
      }, (payload: { new: Record<string, unknown> }) => {
        queryClient.setQueryData(
          conversationsQueryOptions.queryKey,
          (old: ConversationListResponse | undefined) => {
            if (!old) return old

            const updatedId = payload.new.id as string
            const exists = old.conversations.some((c) => c.id === updatedId)

            if (!exists) {
              queryClient.invalidateQueries({ queryKey: conversationsQueryOptions.queryKey })
              return old
            }

            const conversations = old.conversations
              .map((c): ConversationSummary => {
                if (c.id !== updatedId) return c
                return {
                  ...c,
                  lastMessageAt:
                    (payload.new.last_message_at as string | undefined) ?? c.lastMessageAt,
                  unreadCount:
                    (payload.new.unread_count as number | undefined) ?? c.unreadCount,
                  lastMessagePreview:
                    (payload.new.last_message_preview as string | undefined) ??
                    c.lastMessagePreview,
                }
              })
              .sort(
                (a, b) =>
                  new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
              )

            return { ...old, conversations }
          },
        )
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [auth?.tenantId, queryClient])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="loading loading-spinner loading-md" />
      </div>
    )
  }

  const conversations = data?.conversations ?? []

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-base-content/50">
        No conversations yet
      </div>
    )
  }

  return (
    <ul className="divide-y divide-base-200">
      {conversations.map((conversation) => (
        <li
          key={conversation.id}
          className="cursor-pointer px-4 py-3 hover:bg-base-200 transition-colors"
          onClick={() => {
            markReadMutation.mutate(conversation.id)
            onSelect?.(conversation.id)
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate">
              {conversation.leadDisplayName ?? conversation.leadPhoneNumber}
            </span>
            {conversation.unreadCount > 0 && (
              <span className="badge badge-primary badge-sm shrink-0">
                {conversation.unreadCount}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-base-content/60 truncate">
            {conversation.lastMessagePreview}
          </p>
        </li>
      ))}
    </ul>
  )
}
