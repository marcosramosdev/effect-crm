import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { RegisterRequestSchema } from '@shared/auth'
import type { RegisterRequest } from '@shared/auth'
import { useRegisterMutation } from './useRegisterMutation'

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
    <div className="card w-full max-w-md bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-2xl">Criar conta</h2>

        <form
          onSubmit={handleSubmit((data) => mutate(data))}
          className="flex flex-col gap-4"
        >
          <div className="form-control">
            <label className="label" htmlFor="tenantName">
              <span className="label-text">Nome da empresa</span>
            </label>
            <input
              id="tenantName"
              type="text"
              className="input input-bordered"
              {...register('tenantName')}
            />
            {errors.tenantName && (
              <span className="text-error text-sm mt-1">{errors.tenantName.message}</span>
            )}
          </div>

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
            <div className="alert alert-error text-sm">
              {(error as { message?: string }).message ?? 'Erro ao criar conta.'}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={isPending}>
            {isPending ? <span className="loading loading-spinner loading-sm" /> : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-sm mt-2">
          Já tem conta?{' '}
          <Link to="/auth/login" className="link link-primary">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
