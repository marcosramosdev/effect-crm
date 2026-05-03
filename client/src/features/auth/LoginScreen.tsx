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
      title="Bem-vindo de volta"
      subtitle="Entre na sua conta para acessar a caixa de entrada e o pipeline."
      footer={
        <p className="text-center text-sm">
          Ainda não tem conta?{' '}
          <Link to="/auth/register" className="link link-primary font-medium">
            Criar conta grátis
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
          autoComplete="email"
          placeholder="voce@empresa.com.br"
          registration={register('email')}
          error={errors.email?.message}
        />
        <AuthFormField
          id="password"
          label="Senha"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          registration={register('password')}
          error={errors.password?.message}
        />

        {error && (
          <div className="alert alert-error rounded-xl text-sm py-2.5 border-0 bg-error/10 text-error">
            Email ou senha inválidos.
          </div>
        )}

        <button
          type="submit"
          className="btn btn-neutral rounded-xl h-11 mt-2 gap-2"
          disabled={isPending}
        >
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
