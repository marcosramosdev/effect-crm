import { z } from 'zod'

export const ConnectionStatusSchema = z.enum([
  'disconnected',
  'qr_pending',
  'connecting',
  'connected',
  'error',
])

export const ConnectionResponseSchema = z.object({
  status: ConnectionStatusSchema,
  phoneNumber: z.string().nullable(),
  lastHeartbeatAt: z.string().datetime().nullable(),
  lastError: z.string().nullable(),
})

export const StartConnectionResponseSchema = z.object({
  status: z.enum(['qr_pending', 'connecting', 'connected']),
  qr: z.string().nullable(),
})

export const WebhookEventEnvelopeSchema = z.object({
  event: z.enum(['messages', 'messages_update', 'connection']),
  instance: z.string(),
  data: z.unknown(),
})

export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>
export type ConnectionResponse = z.infer<typeof ConnectionResponseSchema>
export type StartConnectionResponse = z.infer<typeof StartConnectionResponseSchema>
export type WebhookEventEnvelope = z.infer<typeof WebhookEventEnvelopeSchema>
