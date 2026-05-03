import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '../../../hooks/useAuth'
import { DashboardLayout } from '../../../features/shell/DashboardLayout'
import { useState } from 'react'

export const Route = createFileRoute('/app/settings/profile')({
  component: ProfileSettingsPage,
})

function ProfileSettingsPage() {
  const { data: auth } = useAuth()
  const [displayName, setDisplayName] = useState(
    auth?.email.split('@')[0] ?? '',
  )
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)

  return (
    <DashboardLayout
      title="Configurações"
      subtitle="Gerencie seus dados de perfil e de acesso"
    >
      <div className="max-w-2xl mx-auto w-full space-y-8">
        <section className="surface-card p-6 sm:p-8 anim-fade-up">
          <header className="mb-6">
            <h2 className="font-display font-semibold text-xl tracking-tight">
              Perfil
            </h2>
            <p className="text-sm text-base-content/60 mt-1">
              Como você aparece para o seu time.
            </p>
          </header>

          <div className="space-y-5">
            <Field
              id="displayName"
              label="Nome de exibição"
              value={displayName}
              onChange={setDisplayName}
            />
            <Field
              id="email"
              label="Email"
              value={auth?.email ?? ''}
              disabled
              hint="O email é gerenciado pelo seu provedor de autenticação."
            />
            <Field
              id="avatarUrl"
              label="URL do avatar"
              placeholder="https://…"
            />

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                className="btn btn-neutral rounded-full px-5"
              >
                Salvar alterações
              </button>
              <button
                type="button"
                className="btn btn-ghost rounded-full border border-base-200"
                onClick={() => setPasswordModalOpen(true)}
              >
                Alterar senha
              </button>
            </div>
          </div>
        </section>

        {passwordModalOpen && (
          <dialog open className="modal modal-open">
            <div className="modal-box rounded-2xl border border-base-200">
              <h3 className="font-display font-bold text-lg tracking-tight">
                Alterar senha
              </h3>
              <p className="text-sm text-base-content/60 mt-1">
                Use uma senha forte com no mínimo 8 caracteres.
              </p>
              <div className="space-y-3 mt-5">
                <input
                  type="password"
                  className="input input-bordered w-full rounded-xl h-11"
                  placeholder="Senha atual"
                />
                <input
                  type="password"
                  className="input input-bordered w-full rounded-xl h-11"
                  placeholder="Nova senha"
                />
                <input
                  type="password"
                  className="input input-bordered w-full rounded-xl h-11"
                  placeholder="Confirmar nova senha"
                />
              </div>
              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost rounded-full"
                  onClick={() => setPasswordModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-neutral rounded-full px-5"
                >
                  Salvar
                </button>
              </div>
            </div>
          </dialog>
        )}
      </div>
    </DashboardLayout>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
  hint,
}: {
  id: string
  label: string
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  disabled?: boolean
  hint?: string
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[12px] font-medium text-base-content/70 mb-1.5 px-1"
      >
        {label}
      </label>
      <input
        id={id}
        className="input input-bordered w-full rounded-xl h-11 disabled:opacity-60 disabled:bg-base-200/50"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      {hint && (
        <p className="text-[11px] text-base-content/45 mt-1.5 px-1">{hint}</p>
      )}
    </div>
  )
}
