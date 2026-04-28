import type { AuthErrorCode } from '../../types/auth'

interface MappedError {
  httpStatus: number
  code: AuthErrorCode
  message: string
}

export function mapSupabaseError(err: unknown): MappedError {
  if (err != null && typeof err === 'object') {
    const e = err as Record<string, unknown>

    if (e.status === 429) {
      return {
        httpStatus: 429,
        code: 'RATE_LIMITED',
        message: 'Demasiadas tentativas. Tenta novamente mais tarde.',
      }
    }

    const msg = typeof e.message === 'string' ? e.message : ''

    if (msg === 'invalid_grant' || msg === 'user_not_found') {
      return {
        httpStatus: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Email ou senha inválidos.',
      }
    }

    if (msg === 'email_exists') {
      return {
        httpStatus: 409,
        code: 'EMAIL_EXISTS_OR_INVALID',
        message: 'Não foi possível criar a conta com este email.',
      }
    }

    if (msg === 'weak_password') {
      return {
        httpStatus: 400,
        code: 'WEAK_PASSWORD',
        message: 'Senha não cumpre os requisitos mínimos.',
      }
    }

    if (msg === 'tenant_name_invalid') {
      return {
        httpStatus: 400,
        code: 'TENANT_NAME_INVALID',
        message: 'Nome da empresa inválido (2–80 caracteres).',
      }
    }
  }

  return {
    httpStatus: 500,
    code: 'UNKNOWN',
    message: 'Erro inesperado. Tenta novamente.',
  }
}
