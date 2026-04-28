import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { LoginRequestSchema } from '@shared/auth'
import type { LoginRequest } from '@shared/auth'
import { useLoginMutation } from './useLoginMutation'

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
    <div className="card w-full max-w-md bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-2xl">Entrar</h2>

        <form
          onSubmit={handleSubmit((data) =>
            mutate(data, {
              onError: () => resetField('password'),
            }),
          )}
          className="flex flex-col gap-4"
        >
          <div className="form-control">
            <label className="label" htmlFor="email">
              <span className="label-text">Email</span>
            </label>
            <input
              id="email"
              type="email"
              className="input input-bordered"
              {...register('email')}
            />
            {errors.email && (
              <span className="text-error text-sm mt-1">{errors.email.message}</span>
            )}
          </div>

          <div className="form-control">
            <label className="label" htmlFor="password">
              <span className="label-text">Senha</span>
            </label>
            <input
              id="password"
              type="password"
              className="input input-bordered"
              {...register('password')}
            />
            {errors.password && (
              <span className="text-error text-sm mt-1">{errors.password.message}</span>
            )}
          </div>

          {error && (
            <div className="alert alert-error text-sm">Email ou senha inválidos.</div>
          )}

          <button type="submit" className="btn btn-primary" disabled={isPending}>
            {isPending ? <span className="loading loading-spinner loading-sm" /> : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm mt-2">
          Não tem conta?{' '}
          <Link to="/auth/register" className="link link-primary">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  )
}
