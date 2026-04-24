import { z } from 'zod'

export const TenantIdSchema = z.string().uuid()
export const UserIdSchema = z.string().uuid()
export const LeadIdSchema = z.string().uuid()
export const ConversationIdSchema = z.string().uuid()
export const MessageIdSchema = z.string().uuid()
export const StageIdSchema = z.string().uuid()

export const RoleSchema = z.enum(['owner', 'agent'])

export const ErrorCodeSchema = z.enum([
  'RATE_LIMITED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'WHATSAPP_DISCONNECTED',
  'INSTANCE_MISMATCH',
  'CONFLICT',
  'INTERNAL',
])

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
})

export type TenantId = z.infer<typeof TenantIdSchema>
export type UserId = z.infer<typeof UserIdSchema>
export type LeadId = z.infer<typeof LeadIdSchema>
export type ConversationId = z.infer<typeof ConversationIdSchema>
export type MessageId = z.infer<typeof MessageIdSchema>
export type StageId = z.infer<typeof StageIdSchema>
export type Role = z.infer<typeof RoleSchema>
export type ErrorCode = z.infer<typeof ErrorCodeSchema>
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
