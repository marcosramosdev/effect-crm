import type { MiddlewareHandler } from 'hono'
import type { ErrorCode } from '../types/common'

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class UazapiUnauthorizedError extends Error {
  constructor(message = 'Uazapi authentication failed') {
    super(message)
    this.name = 'UazapiUnauthorizedError'
  }
}

export class UazapiRateLimitedError extends Error {
  constructor(public readonly retryAfter?: number) {
    super('Uazapi rate limited')
    this.name = 'UazapiRateLimitedError'
  }
}

export class UazapiTransientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UazapiTransientError'
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError || (err instanceof Error && err.name === 'ApiError')
}

export function errorHandler(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next()
    } catch (err) {
      if (isApiError(err)) {
        const body: Record<string, unknown> = { code: err.code, message: err.message }
        if (err.details !== undefined) body.details = err.details
        return c.json({ error: body }, err.statusCode as Parameters<typeof c.json>[1])
      }
      console.error('Unexpected error:', err)
      return c.json({ error: { code: 'INTERNAL', message: 'Internal server error' } }, 500)
    }
  }
}
