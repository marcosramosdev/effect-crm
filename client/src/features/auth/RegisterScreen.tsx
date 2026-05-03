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
      title="Crie sua conta"
      subtitle="Comece em menos de um minuto. Sem cartão de crédito."
      footer={
        <p className="text-center text-sm">
          Já tem uma conta?{' '}
          <Link to="/auth/login" className="link link-primary font-medium">
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
          autoComplete="organization"
          placeholder="Agência Lume"
          registration={register('tenantName')}
          error={errors.tenantName?.message}
        />
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
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          registration={register('password')}
          error={errors.password?.message}
        />

        {error && (
          <div className="alert alert-error rounded-xl text-sm py-2.5 border-0 bg-error/10 text-error">
            {(error as { message?: string }).message ?? 'Erro ao criar conta.'}
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
            'Criar conta'
          )}
        </button>

        <p className="text-[11px] text-base-content/45 text-center px-2 mt-1 leading-relaxed">
          Ao criar sua conta você aceita nossos termos de uso e a política de
          privacidade.
        </p>
      </form>
    </AuthFormShell>
  )
}
