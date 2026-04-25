import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, useCallback } from 'react'
import { apiFetch } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { ConversationDetail, Message } from '@shared/inbox'
import { SendMessageForm } from './SendMessageForm'

interface ConversationViewProps {
  conversationId: string
}

export function conversationQueryKey(conversationId: string) {
  return ['inbox', 'conversation', conversationId] as const
}

function toMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    direction: row.direction as 'inbound' | 'outbound',
    contentType: row.content_type as 'text' | 'unsupported',
    text: (row.text as string | null) ?? null,
    sentByUserId: (row.sent_by_user_id as string | null) ?? null,
    status:
      (row.status as 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | null) ?? null,
    error: (row.error as string | null) ?? null,
    createdAt: row.created_at as string,
    readAt: (row.read_at as string | null) ?? null,
  }
}

function OutboundStatus({ status }: { status: Message['status'] }) {
  if (status === 'pending') {
    return <span className="loading loading-spinner loading-xs ml-1 align-middle" />
  }
  if (status === 'delivered') {
    return <span className="text-xs ml-1 opacity-60" aria-label="delivered">✓✓</span>
  }
  if (status === 'read') {
    return <span className="text-xs ml-1 text-blue-400" aria-label="read">✓✓</span>
  }
  return null
}

export function ConversationView({ conversationId }: ConversationViewProps) {
  const queryClient = useQueryClient()
  const { data: auth } = useAuth()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [retryText, setRetryText] = useState('')

  const handleRetry = useCallback((text: string) => setRetryText(text), [])
  const clearRetryText = useCallback(() => setRetryText(''), [])

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: conversationQueryKey(conversationId),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      apiFetch<ConversationDetail>(
        `/inbox/conversations/${conversationId}${pageParam ? `?beforeCursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (lastPage: ConversationDetail) => lastPage.nextBeforeCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  })

  useEffect(() => {
    if (data?.pages.length === 1) {
      messagesEndRef.current?.scrollIntoView()
    }
  }, [data?.pages.length])

  useEffect(() => {
    if (!auth?.tenantId) return

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload: { new: Record<string, unknown> }) => {
        const newMsg = toMessage(payload.new)
        queryClient.setQueryData(
          conversationQueryKey(conversationId),
          (
            old:
              | { pages: ConversationDetail[]; pageParams: unknown[] }
              | undefined,
          ) => {
            if (!old || old.pages.length === 0) return old
            const lastPage = old.pages[old.pages.length - 1]
            return {
              ...old,
              pages: [
                ...old.pages.slice(0, -1),
                { ...lastPage, messages: [...lastPage.messages, newMsg] },
              ],
            }
          },
        )
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [auth?.tenantId, conversationId, queryClient])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  const lead = data?.pages[0]?.lead
  const allMessages = data?.pages
    .slice()
    .reverse()
    .flatMap((page) => [...page.messages].reverse()) ?? []

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-base-200">
        <p className="font-semibold">{lead?.displayName ?? lead?.phoneNumber}</p>
        {lead?.displayName && lead?.phoneNumber && (
          <p className="text-sm text-base-content/60">{lead.phoneNumber}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {hasNextPage && (
          <button
            className="btn btn-ghost btn-sm self-center"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              'Load older messages'
            )}
          </button>
        )}

        {allMessages.map((message) => (
          <div
            key={message.id}
            className={`chat ${message.direction === 'outbound' ? 'chat-end' : 'chat-start'}`}
          >
            <div
              className={`chat-bubble ${message.direction === 'outbound' ? 'chat-bubble-primary' : ''}`}
            >
              {message.contentType === 'unsupported' ? (
                <span className="text-sm italic opacity-70">Unsupported message type</span>
              ) : (
                message.text
              )}
              {message.direction === 'outbound' && (
                <OutboundStatus status={message.status} />
              )}
            </div>
            {message.direction === 'outbound' && message.status === 'failed' && (
              <div className="chat-footer mt-1">
                <div role="alert" className="alert alert-error py-1 px-2 text-xs gap-1">
                  <span>Falha no envio</span>
                  <button
                    className="btn btn-xs btn-ghost"
                    onClick={() => handleRetry(message.text ?? '')}
                  >
                    Tentar novamente
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      <SendMessageForm
        conversationId={conversationId}
        prefillText={retryText}
        onPrefillConsumed={clearRetryText}
      />
    </div>
  )
}
