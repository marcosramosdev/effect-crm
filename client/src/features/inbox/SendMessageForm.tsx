import { useState, useRef, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, Smile, Paperclip } from 'lucide-react'
import type { z } from 'zod'
import { apiFetch, RateLimitedError } from '../../lib/api'
import { SendMessageRequestSchema } from '@shared/inbox'
import type { ConversationDetail, Message } from '@shared/inbox'

type FormValues = z.infer<typeof SendMessageRequestSchema>

function conversationQueryKey(conversationId: string) {
  return ['inbox', 'conversation', conversationId] as const
}

interface SendMessageFormProps {
  conversationId: string
  prefillText?: string
  onPrefillConsumed?: () => void
}

export function SendMessageForm({
  conversationId,
  prefillText,
  onPrefillConsumed,
}: SendMessageFormProps) {
  const queryClient = useQueryClient()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [retryAfterSecs, setRetryAfterSecs] = useState<number | null>(null)
  const savedTextRef = useRef('')

  const { register, handleSubmit, reset, setValue, watch } =
    useForm<FormValues>({
      resolver: zodResolver(SendMessageRequestSchema),
      defaultValues: { text: '' },
    })

  const textValue = watch('text')

  const stableOnPrefillConsumed = useCallback(() => {
    onPrefillConsumed?.()
  }, [onPrefillConsumed])

  useEffect(() => {
    if (prefillText) {
      setValue('text', prefillText)
      stableOnPrefillConsumed()
    }
  }, [prefillText, setValue, stableOnPrefillConsumed])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      apiFetch<{ message: Message }>(
        `/inbox/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        },
      ),
    onMutate: (values) => {
      setErrorMsg(null)
      setRetryAfterSecs(null)
      savedTextRef.current = values.text
      reset()

      const optimistic: Message = {
        id: crypto.randomUUID(),
        conversationId,
        direction: 'outbound',
        contentType: 'text',
        text: values.text,
        sentByUserId: null,
        status: 'pending',
        error: null,
        createdAt: new Date().toISOString(),
        readAt: null,
      }

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
              { ...lastPage, messages: [...lastPage.messages, optimistic] },
            ],
          }
        },
      )
    },
    onError: (err) => {
      setValue('text', savedTextRef.current)
      if (err instanceof RateLimitedError) {
        setRetryAfterSecs(err.retryAfter ?? null)
        return
      }
      const e = err as Error & { status?: number }
      if (e.status === 409) {
        setErrorMsg('Reconecte o WhatsApp')
        return
      }
      setErrorMsg(e.message)
    },
  })

  const isDisabled =
    !textValue || textValue.trim().length === 0 || mutation.isPending

  function submit() {
    void handleSubmit((values) => mutation.mutate(values))()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="px-4 sm:px-6 py-3 border-t border-base-200 bg-base-100"
    >
      {errorMsg && (
        <div
          role="alert"
          className="alert bg-warning/15 text-warning-content border-0 rounded-xl py-2 mb-2 text-sm"
        >
          {errorMsg}
        </div>
      )}
      {retryAfterSecs !== null && (
        <p role="status" className="text-xs text-warning mb-2 font-medium">
          Tente novamente em {retryAfterSecs} segundos
        </p>
      )}
      <div className="flex items-end gap-2 rounded-2xl border border-base-200 bg-base-100 px-2 py-1.5 focus-within:border-primary/50 focus-within:shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-primary)_15%,transparent)] transition-shadow">
        <button
          type="button"
          aria-label="Anexar arquivo"
          className="btn btn-ghost btn-sm btn-square text-base-content/50 mb-0.5"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          {...register('text')}
          className="textarea flex-1 resize-none min-h-[2.25rem] max-h-32 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 px-1 py-1.5 text-[14px] leading-relaxed"
          rows={1}
          placeholder="Escreva uma mensagem…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isDisabled) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <button
          type="button"
          aria-label="Inserir emoji"
          className="btn btn-ghost btn-sm btn-square text-base-content/50 mb-0.5"
        >
          <Smile className="h-4 w-4" />
        </button>
        <button
          type="submit"
          aria-label="Enviar"
          className="btn btn-primary btn-sm btn-square mb-0.5 shadow-[0_4px_14px_-6px_color-mix(in_oklch,var(--color-primary)_60%,transparent)]"
          disabled={isDisabled}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}
