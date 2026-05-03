import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus, Trash2 } from 'lucide-react'
import { authQueryOptions } from '../../../hooks/useAuth'
import { apiFetch } from '../../../lib/api'
import { DashboardLayout } from '../../../features/shell/DashboardLayout'

export const Route = createFileRoute('/app/settings/team')({
  beforeLoad: async ({ context }) => {
    const auth = await context.queryClient.ensureQueryData(authQueryOptions)
    if (auth.role !== 'owner') {
      throw redirect({ to: '/app/inbox' })
    }
  },
  component: TeamSettingsPage,
})

interface Member {
  userId: string
  role: 'owner' | 'agent'
  createdAt: string
}

const teamQueryOptions = {
  queryKey: ['team', 'members'] as const,
  queryFn: (): Promise<{ members: Member[] }> => apiFetch('/team'),
}

const InviteSchema = z.object({
  email: z.string().email('Email inválido'),
  role: z.enum(['owner', 'agent']),
})

type InviteInput = z.infer<typeof InviteSchema>

function TeamSettingsPage() {
  const queryClient = useQueryClient()
  const [removeModal, setRemoveModal] = useState<Member | null>(null)

  const { data } = useQuery(teamQueryOptions)
  const members = data?.members ?? []

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteInput>({
    resolver: zodResolver(InviteSchema),
    defaultValues: { role: 'agent' },
  })

  const inviteMutation = useMutation({
    mutationFn: (input: InviteInput) =>
      apiFetch('/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamQueryOptions.queryKey })
      reset()
    },
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/team/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamQueryOptions.queryKey })
      setRemoveModal(null)
    },
  })

  return (
    <DashboardLayout
      title="Equipe"
      subtitle="Gerencie membros e permissões da sua organização"
    >
      <div className="max-w-3xl mx-auto w-full space-y-8 anim-fade-up">
        <section className="surface-card p-6 sm:p-8">
          <header className="mb-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display font-semibold text-xl tracking-tight">
                Membros
              </h2>
              <p className="text-sm text-base-content/60 mt-1">
                {members.length}{' '}
                {members.length === 1 ? 'pessoa' : 'pessoas'} na equipe.
              </p>
            </div>
          </header>
          <div className="overflow-x-auto rounded-xl border border-base-200">
            <table className="table">
              <thead className="bg-base-200/40">
                <tr className="text-[11px] uppercase tracking-wider text-base-content/55">
                  <th>Usuário</th>
                  <th>Papel</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.userId} className="hover">
                    <td className="font-mono text-xs text-base-content/75">
                      {member.userId}
                    </td>
                    <td>
                      <span
                        className={`chip ${member.role === 'owner' ? 'chip-primary' : ''}`}
                      >
                        {member.role === 'owner' ? 'Proprietário' : 'Agente'}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-error gap-1.5 rounded-full"
                        onClick={() => setRemoveModal(member)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-8 text-center text-sm text-base-content/50"
                    >
                      Nenhum membro ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="surface-card p-6 sm:p-8">
          <header className="mb-5">
            <h2 className="font-display font-semibold text-xl tracking-tight">
              Convidar membro
            </h2>
            <p className="text-sm text-base-content/60 mt-1">
              Envie um convite por email.
            </p>
          </header>
          <form
            onSubmit={handleSubmit((values) => inviteMutation.mutate(values))}
            className="flex flex-col gap-3 sm:flex-row sm:items-start"
          >
            <div className="flex-1">
              <input
                {...register('email')}
                type="email"
                className="input input-bordered w-full rounded-xl h-11"
                placeholder="email@empresa.com.br"
              />
              {errors.email && (
                <p className="text-error text-xs mt-1.5 px-1" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>
            <select
              {...register('role')}
              className="select select-bordered rounded-xl h-11"
            >
              <option value="agent">Agente</option>
              <option value="owner">Proprietário</option>
            </select>
            <button
              type="submit"
              className="btn btn-neutral rounded-xl h-11 px-5 gap-1.5"
              disabled={inviteMutation.isPending}
            >
              <UserPlus className="h-4 w-4" />
              Convidar
            </button>
          </form>
          {inviteMutation.isError && (
            <p className="text-error text-sm mt-3">
              Não foi possível enviar o convite. Tente novamente.
            </p>
          )}
          {inviteMutation.isSuccess && (
            <p className="text-success text-sm mt-3">
              Convite enviado com sucesso.
            </p>
          )}
        </section>
      </div>

      {removeModal && (
        <dialog
          open
          role="dialog"
          aria-modal="true"
          className="modal modal-open"
        >
          <div className="modal-box rounded-2xl border border-base-200">
            <h3 className="font-display font-bold text-lg tracking-tight">
              Remover membro
            </h3>
            <p className="py-2 text-sm text-base-content/70">
              Tem certeza que quer remover este membro (
              {removeModal.role === 'owner' ? 'proprietário' : 'agente'})?
            </p>
            {removeMutation.isError && (
              <p className="text-error text-sm mt-1">
                Não foi possível remover. Verifique se ainda há um proprietário
                na equipe.
              </p>
            )}
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost rounded-full"
                onClick={() => {
                  setRemoveModal(null)
                  removeMutation.reset()
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-error rounded-full px-5"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(removeModal.userId)}
              >
                Remover
              </button>
            </div>
          </div>
        </dialog>
      )}
    </DashboardLayout>
  )
}
