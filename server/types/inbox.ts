import { z } from 'zod'

export const LeadSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  phoneNumber: z.string(),
  displayName: z.string().nullable(),
  stageId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Lead = z.infer<typeof LeadSchema>

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  direction: z.enum(['inbound', 'outbound']),
  contentType: z.enum(['text', 'unsupported']),
  text: z.string().nullable(),
  sentByUserId: z.string().uuid().nullable(),
  status: z.enum(['pending', 'sent', 'delivered', 'read', 'failed']).nullable(),
  error: z.string().nullable(),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
})
export type Message = z.infer<typeof MessageSchema>

export const ConversationSummarySchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  leadDisplayName: z.string().nullable(),
  leadPhoneNumber: z.string(),
  lastMessagePreview: z.string(),
  lastMessageAt: z.string().datetime(),
  unreadCount: z.number().int().nonnegative(),
  stageId: z.string().uuid(),
})
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>

export const ConversationListResponseSchema = z.object({
  conversations: z.array(ConversationSummarySchema),
  nextCursor: z.string().datetime().nullable(),
})
export type ConversationListResponse = z.infer<typeof ConversationListResponseSchema>

export const ConversationDetailSchema = z.object({
  id: z.string().uuid(),
  lead: LeadSchema,
  messages: z.array(MessageSchema),
  nextBeforeCursor: z.string().datetime().nullable(),
})
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>

export const ListConversationsQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  unreadOnly: z.coerce.boolean().default(false),
  search: z.string().trim().min(1).optional(),
})
export type ListConversationsQuery = z.infer<typeof ListConversationsQuerySchema>

export const ListMessagesQuerySchema = z.object({
  beforeCursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})
export type ListMessagesQuery = z.infer<typeof ListMessagesQuerySchema>

export const MarkReadResponseSchema = z.object({
  conversationId: z.string().uuid(),
  unreadCount: z.literal(0),
})
export type MarkReadResponse = z.infer<typeof MarkReadResponseSchema>

export const SendMessageRequestSchema = z.object({
  text: z.string().trim().min(1).max(4096),
})
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>

export const SendMessageResponseSchema = z.object({
  message: MessageSchema,
})
export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>
