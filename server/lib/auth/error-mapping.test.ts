import { describe, it, expect } from 'bun:test'
import { mapSupabaseError } from './error-mapping'

describe('mapSupabaseError', () => {
  it('invalid_grant → 401 INVALID_CREDENTIALS', () => {
    const result = mapSupabaseError({ message: 'invalid_grant' })
    expect(result.httpStatus).toBe(401)
    expect(result.code).toBe('INVALID_CREDENTIALS')
    expect(result.message).toBe('Email ou senha inválidos.')
  })

  it('user_not_found → 401 INVALID_CREDENTIALS', () => {
    const result = mapSupabaseError({ message: 'user_not_found' })
    expect(result.httpStatus).toBe(401)
    expect(result.code).toBe('INVALID_CREDENTIALS')
    expect(result.message).toBe('Email ou senha inválidos.')
  })

  it('email_exists → 409 EMAIL_EXISTS_OR_INVALID', () => {
    const result = mapSupabaseError({ message: 'email_exists' })
    expect(result.httpStatus).toBe(409)
    expect(result.code).toBe('EMAIL_EXISTS_OR_INVALID')
    expect(result.message).toBe('Não foi possível criar a conta com este email.')
  })

  it('weak_password → 400 WEAK_PASSWORD', () => {
    const result = mapSupabaseError({ message: 'weak_password' })
    expect(result.httpStatus).toBe(400)
    expect(result.code).toBe('WEAK_PASSWORD')
    expect(result.message).toBe('Senha não cumpre os requisitos mínimos.')
  })

  it('tenant_name_invalid → 400 TENANT_NAME_INVALID', () => {
    const result = mapSupabaseError({ message: 'tenant_name_invalid' })
    expect(result.httpStatus).toBe(400)
    expect(result.code).toBe('TENANT_NAME_INVALID')
    expect(result.message).toBe('Nome da empresa inválido (2–80 caracteres).')
  })

  it('status 429 → 429 RATE_LIMITED', () => {
    const result = mapSupabaseError({ status: 429 })
    expect(result.httpStatus).toBe(429)
    expect(result.code).toBe('RATE_LIMITED')
    expect(result.message).toBe('Demasiadas tentativas. Tenta novamente mais tarde.')
  })

  it('unknown error → 500 UNKNOWN', () => {
    const result = mapSupabaseError({ message: 'something_else' })
    expect(result.httpStatus).toBe(500)
    expect(result.code).toBe('UNKNOWN')
    expect(result.message).toBe('Erro inesperado. Tenta novamente.')
  })

  it('null input → 500 UNKNOWN', () => {
    const result = mapSupabaseError(null)
    expect(result.httpStatus).toBe(500)
    expect(result.code).toBe('UNKNOWN')
  })
})
