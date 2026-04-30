import type { ReactNode } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'

interface AuthFormShellProps {
  title: string
  children: ReactNode
  footer: ReactNode
}

export function AuthFormShell({ title, children, footer }: AuthFormShellProps) {
  return (
    <div className="card w-full max-w-md bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-2xl">{title}</h2>
        {children}
        {footer}
      </div>
    </div>
  )
}

interface AuthFormFieldProps {
  id: string
  label: string
  type: string
  registration: UseFormRegisterReturn
  error?: string
}

export function AuthFormField({
  id,
  label,
  type,
  registration,
  error,
}: AuthFormFieldProps) {
  return (
    <div className="form-control">
      <label className="label" htmlFor={id}>
        <span className="label-text">{label}</span>
      </label>
      <input
        id={id}
        type={type}
        className="input input-bordered"
        {...registration}
      />
      {error && <span className="text-error text-sm mt-1">{error}</span>}
    </div>
  )
}
