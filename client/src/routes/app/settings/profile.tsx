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
    <DashboardLayout title="Perfil">
      <div className="p-4 max-w-2xl space-y-8">
        <div className="space-y-4">
          <div>
            <label htmlFor="displayName" className="label">
              <span className="label-text">Nome de exibição</span>
            </label>
            <input
              id="displayName"
              className="input input-bordered w-full"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="email" className="label">
              <span className="label-text">Email</span>
            </label>
            <input
              id="email"
              className="input input-bordered w-full"
              value={auth?.email ?? ''}
              disabled
            />
          </div>

          <div>
            <label htmlFor="avatarUrl" className="label">
              <span className="label-text">URL do avatar</span>
            </label>
            <input
              id="avatarUrl"
              className="input input-bordered w-full"
              placeholder="https://..."
            />
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setPasswordModalOpen(true)}
          >
            Alterar senha
          </button>
        </div>

        {passwordModalOpen && (
          <dialog open className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-bold text-lg">Alterar senha</h3>
              <div className="space-y-3 mt-4">
                <input
                  type="password"
                  className="input input-bordered w-full"
                  placeholder="Senha atual"
                />
                <input
                  type="password"
                  className="input input-bordered w-full"
                  placeholder="Nova senha"
                />
                <input
                  type="password"
                  className="input input-bordered w-full"
                  placeholder="Confirmar nova senha"
                />
              </div>
              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPasswordModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary">
                  Guardar
                </button>
              </div>
            </div>
          </dialog>
        )}
      </div>
    </DashboardLayout>
  )
}
