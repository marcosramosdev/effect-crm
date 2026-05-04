import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Phone, MoreVertical, ChevronUp } from 'lucide-react'
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
      (row.status as
        | 'pending'
        | 'sent'
        | 'delivered'
        | 'read'
        | 'failed'
        | null) ?? null,
    error: (row.error as string | null) ?? null,
    createdAt: row.created_at as string,
    readAt: (row.read_at as string | null) ?? null,
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getInitials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function OutboundStatus({ status }: { status: Message['status'] }) {
  if (status === 'pending') {
    return (
      <span
        className="loading loading-spinner loading-xs ml-1 align-middle opacity-70"
        aria-label="Enviando"
      />
    )
  }
  if (status === 'delivered') {
    return (
      <span className="text-[10px] ml-1.5 opacity-70" aria-label="Entregue">
        ✓✓
      </span>
    )
  }
  if (status === 'read') {
    return (
      <span className="text-[10px] ml-1.5 text-info" aria-label="Lida">
        ✓✓
      </span>
    )
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

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: conversationQueryKey(conversationId),
      queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
        apiFetch<ConversationDetail>(
          `/inbox/conversations/${conversationId}${pageParam ? `?beforeCursor=${encodeURIComponent(pageParam)}` : ''}`,
        ),
      getNextPageParam: (lastPage: ConversationDetail) =>
        lastPage.nextBeforeCursor ?? undefined,
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

      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
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
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [auth?.tenantId, conversationId, queryClient])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  const lead = data?.pages[0]?.lead
  const allMessages =
    data?.pages
      .slice()
      .reverse()
      .flatMap((page) => [...page.messages].reverse()) ?? []

  const headerName = lead?.displayName ?? lead?.phoneNumber ?? '—'

  return (
    <div className="flex flex-col h-full bg-base-100">
      <header className="flex items-center gap-3 px-5 h-16 border-b border-base-200 bg-base-100/85 backdrop-blur-sm">
        <span className="w-9 h-9 rounded-full bg-linear-to-br from-primary/25 to-accent/25 flex items-center justify-center font-semibold text-sm text-base-content/80">
          {getInitials(headerName)}
        </span>
        <div className="flex flex-col min-w-0">
          <p className="font-display font-semibold text-[15px] truncate leading-tight">
            {headerName}
          </p>
          {lead?.displayName && lead.phoneNumber && (
            <p className="text-[11px] text-base-content/55 truncate font-mono mt-0.5">
              {lead.phoneNumber}
            </p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square text-base-content/60"
            aria-label="Ligar"
          >
            <Phone className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square text-base-content/60"
            aria-label="Mais opções"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-base-200/40 px-4 sm:px-8 py-6 flex flex-col gap-1.5">
        {hasNextPage && (
          <button
            type="button"
            className="btn btn-ghost btn-sm self-center rounded-full text-base-content/60 gap-1.5"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Carregar mensagens anteriores
              </>
            )}
          </button>
        )}

        {allMessages.map((message, idx) => {
          const isOutbound = message.direction === 'outbound'
          const groupStart =
            idx === 0 || allMessages[idx - 1].direction !== message.direction
          return (
            <div
              key={message.id}
              className={`chat ${isOutbound ? 'chat-end' : 'chat-start'} ${groupStart ? 'mt-3' : ''}`}
            >
              <div
                className={`chat-bubble max-w-[80%] text-[14px] leading-relaxed shadow-none border ${
                  isOutbound
                    ? 'chat-bubble-primary border-primary/20'
                    : 'bg-base-100 text-base-content border-base-200'
                }`}
              >
                {message.contentType === 'unsupported' ? (
                  <span className="text-sm italic opacity-70">
                    Tipo de mensagem não suportado
                  </span>
                ) : (
                  message.text
                )}
                <span
                  className={`block text-[10px] mt-1 ${isOutbound ? 'text-primary-content/70' : 'text-base-content/45'}`}
                >
                  {formatTime(message.createdAt)}
                  {isOutbound && <OutboundStatus status={message.status} />}
                </span>
              </div>
              {isOutbound && message.status === 'failed' && (
                <div className="chat-footer mt-1">
                  <div
                    role="alert"
                    className="alert bg-error/10 border-0 text-error py-1.5 px-2.5 text-xs gap-1.5 rounded-lg"
                  >
                    <span>Falha no envio</span>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost text-error"
                      onClick={() => handleRetry(message.text ?? '')}
                    >
                      Tentar novamente
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

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
