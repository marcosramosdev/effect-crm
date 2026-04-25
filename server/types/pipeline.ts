import { z } from 'zod'

export const PipelineStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  order: z.number().int(),
  isDefaultEntry: z.boolean(),
})
export type PipelineStage = z.infer<typeof PipelineStageSchema>

export const StageListResponseSchema = z.object({
  stages: z.array(PipelineStageSchema),
})
export type StageListResponse = z.infer<typeof StageListResponseSchema>

export const PipelineLeadSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  phoneNumber: z.string(),
  stageId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type PipelineLead = z.infer<typeof PipelineLeadSchema>

export const LeadListResponseSchema = z.object({
  leads: z.array(PipelineLeadSchema),
  nextCursor: z.string().datetime().nullable(),
})
export type LeadListResponse = z.infer<typeof LeadListResponseSchema>

export const ListLeadsQuerySchema = z.object({
  stageId: z.string().uuid().optional(),
  search: z.string().trim().min(1).optional(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
export type ListLeadsQuery = z.infer<typeof ListLeadsQuerySchema>

export const MoveLeadRequestSchema = z.object({
  stageId: z.string().uuid(),
})
export type MoveLeadRequest = z.infer<typeof MoveLeadRequestSchema>

export const CreateStageRequestSchema = z.object({
  name: z.string().trim().min(1).max(255),
})
export type CreateStageRequest = z.infer<typeof CreateStageRequestSchema>

export const UpdateStageRequestSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  order: z.number().int().min(1).optional(),
})
export type UpdateStageRequest = z.infer<typeof UpdateStageRequestSchema>

export const DeleteStageQuerySchema = z.object({
  destinationStageId: z.string().uuid().optional(),
})
export type DeleteStageQuery = z.infer<typeof DeleteStageQuerySchema>
