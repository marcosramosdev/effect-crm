import { z } from 'zod'
import { RoleSchema } from './common'

export const MeResponseSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  role: RoleSchema,
})

export type MeResponse = z.infer<typeof MeResponseSchema>
