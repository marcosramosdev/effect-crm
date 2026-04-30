import { z } from 'zod'

export const PipelineStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  order: z.number().int(),
  isDefaultEntry: z.boolean(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve ser um hex válido (ex: #64748b)'),
  description: z.string().nullable(),
})
export type PipelineStage = z.infer<typeof PipelineStageSchema>

export const StageListResponseSchema = z.object({
  stages: z.array(PipelineStageSchema),
})
export type StageListResponse = z.infer<typeof StageListResponseSchema>

export const CustomFieldTypeSchema = z.enum(['text', 'number', 'date', 'select', 'url'])
export type CustomFieldType = z.infer<typeof CustomFieldTypeSchema>

export const CustomFieldDefSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  key: z.string(),
  label: z.string(),
  type: CustomFieldTypeSchema,
  options: z.array(z.string()).nullable(),
  order: z.number().int(),
  createdAt: z.string().datetime(),
})
export type CustomFieldDef = z.infer<typeof CustomFieldDefSchema>

export const CustomFieldValueSchema = z.object({
  fieldId: z.string().uuid(),
  value: z.union([z.string(), z.number(), z.string().datetime()]).nullable(),
})
export type CustomFieldValue = z.infer<typeof CustomFieldValueSchema>

export const PipelineLeadSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  phoneNumber: z.string(),
  stageId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  customValues: z.record(z.string(), z.string().nullable()).nullable(),
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

export const CreateLeadRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(255).optional(),
  phoneNumber: z.string().trim().optional(),
  stageId: z.string().uuid(),
  customValues: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
})
export type CreateLeadRequest = z.infer<typeof CreateLeadRequestSchema>

export const UpdateLeadRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(255).optional(),
  phoneNumber: z.string().trim().optional(),
  stageId: z.string().uuid().optional(),
  customValues: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
})
export type UpdateLeadRequest = z.infer<typeof UpdateLeadRequestSchema>

export const CreateStageRequestSchema = z.object({
  name: z.string().trim().min(1).max(255),
})
export type CreateStageRequest = z.infer<typeof CreateStageRequestSchema>

export const UpdateStageRequestSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  order: z.number().int().min(1).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve ser um hex válido (ex: #64748b)').optional(),
  description: z.string().trim().max(500).optional().or(z.literal('').transform(() => undefined)),
})
export type UpdateStageRequest = z.infer<typeof UpdateStageRequestSchema>

export const ReorderStagesRequestSchema = z.object({
  stages: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number().int(),
    }),
  ).min(1),
})
export type ReorderStagesRequest = z.infer<typeof ReorderStagesRequestSchema>

export const DeleteStageQuerySchema = z.object({
  destinationStageId: z.string().uuid().optional(),
})
export type DeleteStageQuery = z.infer<typeof DeleteStageQuerySchema>

export const CreateCustomFieldRequestSchema = z.object({
  key: z.string().trim().min(1).max(50),
  label: z.string().trim().min(1).max(255),
  type: CustomFieldTypeSchema,
  options: z.array(z.string().trim().min(1)).max(50).optional(),
})
export type CreateCustomFieldRequest = z.infer<typeof CreateCustomFieldRequestSchema>

export const UpdateCustomFieldRequestSchema = z.object({
  label: z.string().trim().min(1).max(255).optional(),
  order: z.number().int().min(0).optional(),
  options: z.array(z.string().trim().min(1)).max(50).optional(),
})
export type UpdateCustomFieldRequest = z.infer<typeof UpdateCustomFieldRequestSchema>

export const CustomFieldListResponseSchema = z.object({
  fields: z.array(CustomFieldDefSchema),
})
export type CustomFieldListResponse = z.infer<typeof CustomFieldListResponseSchema>
