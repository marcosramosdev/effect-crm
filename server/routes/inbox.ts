import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createServiceSupabase, createUserSupabase } from '../db/client'
import { sendText, UazapiRateLimitedError } from '../lib/whatsapp/uazapi-client'
import { consume } from '../lib/whatsapp/rate-limiter'
import type { AuthVariables } from '../middlewares/auth'
import { SendMessageRequestSchema } from '../types/inbox'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

interface InboxDeps {
  sendText: typeof sendText
  consume: typeof consume
}

export function createInboxRouter(
  getUserSupabase: (jwt: string) => AnyClient = createUserSupabase,
  getServiceClient: () => AnyClient = createServiceSupabase,
  deps: InboxDeps = { sendText, consume },
) {
  const router = new Hono<{ Variables: AuthVariables }>()

  router.post(
    '/conversations/:id/messages',
    zValidator('json', SendMessageRequestSchema),
    async (c) => {
      const { tenantId, userId, jwt } = c.var
      const conversationId = c.req.param('id')
      const { text } = c.req.valid('json')

      const rl = deps.consume(tenantId)
      if (!rl.ok) {
        return c.json(
          { error: { code: 'RATE_LIMITED', message: 'Limite de envio excedido' } },
          429,
          { 'Retry-After': String(rl.retryAfterSeconds) },
        )
      }

      const serviceDb = getServiceClient()
      const { data: sessionData } = await serviceDb
        .from('whatsapp_sessions')
        .select('status, uazapi_instance_token')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      const session = sessionData as Record<string, unknown> | null
      if (!session || session.status !== 'connected') {
        return c.json(
          { error: { code: 'WHATSAPP_DISCONNECTED', message: 'WhatsApp não está conectado' } },
          409,
        )
      }

      const userDb = getUserSupabase(jwt)
      const { data: convData } = await userDb
        .from('conversations')
        .select('id, leads!inner(phone_number)')
        .eq('id', conversationId)
        .maybeSingle()

      const conv = convData as Record<string, unknown> | null
      if (!conv) {
        return c.json(
          { error: { code: 'NOT_FOUND', message: 'Conversa não encontrada' } },
          404,
        )
      }

      const lead = conv.leads as Record<string, unknown>
      const phoneNumber = lead.phone_number as string

      const messageId = crypto.randomUUID()
      const createdAt = new Date().toISOString()

      const { error: insertError } = await serviceDb.from('messages').insert({
        id: messageId,
        tenant_id: tenantId,
        conversation_id: conversationId,
        direction: 'outbound',
        content_type: 'text',
        text,
        status: 'pending',
        sent_by_user_id: userId,
        created_at: createdAt,
      })

      if (insertError) {
        return c.json(
          { error: { code: 'INTERNAL', message: 'Erro ao gravar mensagem' } },
          500,
        )
      }

      try {
        const { messageId: whatsappMessageId } = await deps.sendText({
          token: session.uazapi_instance_token as string,
          number: phoneNumber,
          text,
        })

        await serviceDb
          .from('messages')
          .update({ whatsapp_message_id: whatsappMessageId })
          .eq('id', messageId)
          .eq('tenant_id', tenantId)

        return c.json(
          {
            message: {
              id: messageId,
              conversationId,
              direction: 'outbound' as const,
              contentType: 'text' as const,
              text,
              sentByUserId: userId,
              status: 'pending' as const,
              error: null,
              createdAt,
              readAt: null,
            },
          },
          202,
        )
      } catch (err) {
        if (err instanceof UazapiRateLimitedError) {
          await serviceDb
            .from('messages')
            .update({ status: 'failed', error: 'Rate limited by WhatsApp' })
            .eq('id', messageId)
            .eq('tenant_id', tenantId)

          const headers: Record<string, string> = {}
          if (err.retryAfter) headers['Retry-After'] = String(err.retryAfter)
          return c.json(
            { error: { code: 'RATE_LIMITED', message: 'WhatsApp recusou (rate limit)' } },
            429,
            headers,
          )
        }

        await serviceDb
          .from('messages')
          .update({
            status: 'failed',
            error: err instanceof Error ? err.message : 'Erro desconhecido',
          })
          .eq('id', messageId)
          .eq('tenant_id', tenantId)

        throw err
      }
    },
  )

  return router
}

export const inboxRouter = createInboxRouter()
