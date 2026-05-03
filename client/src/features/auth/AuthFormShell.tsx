import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import type { UseFormRegisterReturn } from 'react-hook-form'

interface AuthFormShellProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer: ReactNode
}

export function AuthFormShell({
  title,
  subtitle,
  children,
  footer,
}: AuthFormShellProps) {
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-[1.05fr_1fr] bg-base-200">
      {/* Decorative panel */}
      <aside className="hidden lg:flex relative overflow-hidden bg-mesh bg-grain p-12 flex-col justify-between">
        <div
          aria-hidden="true"
          className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-[-12rem] right-[-8rem] w-[26rem] h-[26rem] rounded-full bg-accent/20 blur-3xl"
        />
        <Link
          to="/"
          className="relative inline-flex items-center gap-2.5 w-fit"
        >
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-content font-display font-bold shadow-lg">
            C
          </span>
          <span className="font-display font-semibold tracking-tight">
            CRM Effect
          </span>
        </Link>

        <div className="relative max-w-md anim-fade-up">
          <p className="font-display font-semibold text-3xl leading-tight tracking-tight text-balance">
            “Centralizamos o WhatsApp e o pipeline. A produtividade do time
            triplicou.”
          </p>
          <div className="flex items-center gap-3 mt-6">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-warning text-secondary-content flex items-center justify-center font-display font-semibold">
              M
            </div>
            <div>
              <p className="text-sm font-semibold">Mariana Albuquerque</p>
              <p className="text-xs text-base-content/55">
                Diretora · Agência Lume
              </p>
            </div>
          </div>
        </div>

        <div className="relative flex items-center gap-6 text-xs text-base-content/55">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success anim-pulse-soft" />
            Sistema operacional
          </span>
          <span className="font-mono">99.98% uptime</span>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center p-6 sm:p-10 bg-base-100">
        <div className="w-full max-w-md anim-fade-up">
          <Link
            to="/"
            className="lg:hidden inline-flex items-center gap-2 mb-8"
          >
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-content font-display font-bold text-sm">
              C
            </span>
            <span className="font-display font-semibold tracking-tight">
              CRM Effect
            </span>
          </Link>
          <h1 className="font-display font-bold text-3xl tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-base-content/60 mt-2 text-pretty">
              {subtitle}
            </p>
          )}
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-sm text-base-content/65">{footer}</div>
        </div>
      </main>
    </div>
  )
}

interface AuthFormFieldProps {
  id: string
  label: string
  type: string
  registration: UseFormRegisterReturn
  error?: string
  autoComplete?: string
  placeholder?: string
}

export function AuthFormField({
  id,
  label,
  type,
  registration,
  error,
  autoComplete,
  placeholder,
}: AuthFormFieldProps) {
  return (
    <div className="form-control">
      <label
        className="label py-1 px-1 text-[12px] font-medium text-base-content/70 tracking-wide"
        htmlFor={id}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className={`input input-bordered w-full bg-base-100 rounded-xl h-11 transition-shadow focus:shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-primary)_18%,transparent)] ${error ? 'border-error/60' : ''}`}
        {...registration}
      />
      {error && (
        <span className="text-error text-xs mt-1.5 px-1" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
