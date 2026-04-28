import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { LoginRequestSchema } from '@shared/auth'
import type { LoginRequest } from '@shared/auth'
import { useLoginMutation } from './useLoginMutation'
import { AuthFormShell, AuthFormField } from './AuthFormShell'

interface LoginScreenProps {
  redirectTo?: string
}

export function LoginScreen({ redirectTo }: LoginScreenProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    resetField,
  } = useForm<LoginRequest>({
    resolver: zodResolver(LoginRequestSchema),
  })

  const { mutate, isPending, error } = useLoginMutation(redirectTo)

  return (
    <AuthFormShell
      title="Entrar"
      footer={
        <p className="text-center text-sm mt-2">
          Não tem conta?{' '}
          <Link to="/auth/register" className="link link-primary">
            Criar conta
          </Link>
        </p>
      }
    >
      <form
        onSubmit={handleSubmit((data) =>
          mutate(data, {
            onError: () => resetField('password'),
          }),
        )}
        className="flex flex-col gap-4"
      >
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
            Email ou senha inválidos.
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            'Entrar'
          )}
        </button>
      </form>
    </AuthFormShell>
  )
}
