import { useState, useRef, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(SendMessageRequestSchema),
    defaultValues: { text: '' },
  })

  const textValue = watch('text') ?? ''

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
      apiFetch<{ message: Message }>(`/inbox/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      }),
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
        (old: { pages: ConversationDetail[]; pageParams: unknown[] } | undefined) => {
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

  const isDisabled = !textValue || textValue.trim().length === 0 || mutation.isPending

  function submit() {
    void handleSubmit((values) => mutation.mutate(values))()
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }} className="p-3 border-t border-base-200">
      {errorMsg && (
        <div role="alert" className="alert alert-warning py-2 mb-2 text-sm">
          {errorMsg}
        </div>
      )}
      {retryAfterSecs !== null && (
        <p role="status" className="text-sm text-warning mb-2">
          Tente novamente em {retryAfterSecs} segundos
        </p>
      )}
      <div className="flex gap-2 items-end">
        <textarea
          {...register('text')}
          className="textarea textarea-bordered flex-1 resize-none"
          rows={1}
          placeholder="Escreve uma mensagem..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isDisabled) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <button type="submit" className="btn btn-primary" disabled={isDisabled}>
          Enviar
        </button>
      </div>
    </form>
  )
}
