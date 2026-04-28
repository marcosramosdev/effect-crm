import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { RegisterRequestSchema } from '@shared/auth'
import type { RegisterRequest } from '@shared/auth'
import { useRegisterMutation } from './useRegisterMutation'
import { AuthFormShell, AuthFormField } from './AuthFormShell'

export function RegisterScreen() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterRequest>({
    resolver: zodResolver(RegisterRequestSchema),
  })

  const { mutate, isPending, error } = useRegisterMutation()

  return (
    <AuthFormShell
      title="Criar conta"
      footer={
        <p className="text-center text-sm mt-2">
          Já tem conta?{' '}
          <Link to="/auth/login" className="link link-primary">
            Entrar
          </Link>
        </p>
      }
    >
      <form
        onSubmit={handleSubmit((data) => mutate(data))}
        className="flex flex-col gap-4"
      >
        <AuthFormField
          id="tenantName"
          label="Nome da empresa"
          type="text"
          registration={register('tenantName')}
          error={errors.tenantName?.message}
        />
        <AuthFormField
          id="email"
          label="Email"
          type="email"
          registration={register('email')}
          error={errors.email?.message}
        />
        <AuthFormField
          id="password"
          label="Senha"
          type="password"
          registration={register('password')}
          error={errors.password?.message}
        />

        {error && (
          <div className="alert alert-error text-sm">
            {(error as { message?: string }).message ?? 'Erro ao criar conta.'}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            'Criar conta'
          )}
        </button>
      </form>
    </AuthFormShell>
  )
}
