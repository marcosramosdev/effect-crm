import { z } from 'zod'
import { RoleSchema } from './common'

export const RegisterRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  tenantName: z.string().trim().min(2).max(80),
})

export const LoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
})

export const LogoutRequestSchema = z.object({}).strict()

export const AuthSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number().int().positive(),
})

export const MeResponseSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  role: RoleSchema,
})

export const AuthErrorCodeSchema = z.enum([
  'INVALID_CREDENTIALS',
  'EMAIL_EXISTS_OR_INVALID',
  'WEAK_PASSWORD',
  'TENANT_NAME_INVALID',
  'RATE_LIMITED',
  'UNKNOWN',
])

export const AuthErrorBodySchema = z.object({
  error: z.object({
    code: AuthErrorCodeSchema,
    message: z.string(),
  }),
})

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>
export type LoginRequest = z.infer<typeof LoginRequestSchema>
export type AuthSession = z.infer<typeof AuthSessionSchema>
export type MeResponse = z.infer<typeof MeResponseSchema>
export type AuthErrorCode = z.infer<typeof AuthErrorCodeSchema>
export type AuthErrorBody = z.infer<typeof AuthErrorBodySchema>
