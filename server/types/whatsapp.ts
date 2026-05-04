import { z } from 'zod'

export const ConnectionStatusSchema = z.enum([
  'disconnected',
  'qr_pending',
  'connecting',
  'connected',
  'error',
])

export const CreateInstanceBodySchema = z.object({
  name: z.string().trim().min(1).max(64),
})

export const CreateInstanceResponseSchema = z.object({
  instanceId: z.string().optional(),
  name: z.string(),
  status: z.literal('disconnected'),
})

export const ConnectInstanceResponseSchema = z.object({
  status: z.literal('qr_pending'),
  qr: z.string().nullable(),
  qrExpiresAt: z.string().datetime(),
})

export const InstanceStatusDTOSchema = z.object({
  status: ConnectionStatusSchema,
  instanceName: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  lastHeartbeatAt: z.string().datetime().nullable(),
  lastError: z.string().nullable(),
  qrExpiresAt: z.string().datetime().nullable(),
  qr: z.string().nullable(),
})

// Backward-compatible aliases used by older client code.
export const ConnectionResponseSchema = InstanceStatusDTOSchema
export const StartConnectionResponseSchema = ConnectInstanceResponseSchema

export const WebhookEventEnvelopeSchema = z.object({
  event: z.enum(['messages', 'messages_update', 'connection']),
  instance: z.string(),
  data: z.unknown(),
})

export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>
export type CreateInstanceBody = z.infer<typeof CreateInstanceBodySchema>
export type CreateInstanceResponse = z.infer<typeof CreateInstanceResponseSchema>
export type ConnectInstanceResponse = z.infer<typeof ConnectInstanceResponseSchema>
export type InstanceStatusDTO = z.infer<typeof InstanceStatusDTOSchema>
export type ConnectionResponse = z.infer<typeof ConnectionResponseSchema>
export type StartConnectionResponse = z.infer<typeof StartConnectionResponseSchema>
export type WebhookEventEnvelope = z.infer<typeof WebhookEventEnvelopeSchema>
