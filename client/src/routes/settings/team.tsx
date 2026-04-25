import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authQueryOptions } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/api'

export const Route = createFileRoute('/settings/team')({
  beforeLoad: async ({ context }) => {
    const auth = await context.queryClient.ensureQueryData(authQueryOptions)
    if (auth?.role !== 'owner') {
      throw redirect({ to: '/inbox' })
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
    <div className="h-screen flex flex-col">
      <div className="px-4 py-3 border-b border-base-200">
        <h1 className="text-lg font-semibold">Equipa</h1>
      </div>

      <div className="flex-1 overflow-auto p-4 max-w-2xl">
        <div className="mb-8">
          <h2 className="text-base font-semibold mb-3">Membros</h2>
          <table className="table w-full">
            <thead>
              <tr>
                <th>Utilizador</th>
                <th>Papel</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId}>
                  <td className="font-mono text-sm">{member.userId}</td>
                  <td>
                    <span className={`badge ${member.role === 'owner' ? 'badge-primary' : 'badge-ghost'}`}>
                      {member.role}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-error btn-outline"
                      onClick={() => setRemoveModal(member)}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-3">Convidar membro</h2>
          <form
            onSubmit={handleSubmit((data) => inviteMutation.mutate(data))}
            className="flex flex-col gap-3 sm:flex-row sm:items-start"
          >
            <div className="flex-1">
              <input
                {...register('email')}
                type="email"
                className="input input-bordered w-full"
                placeholder="email@exemplo.com"
              />
              {errors.email && <p className="text-error text-sm mt-1">{errors.email.message}</p>}
            </div>
            <select {...register('role')} className="select select-bordered">
              <option value="agent">Agente</option>
              <option value="owner">Owner</option>
            </select>
            <button type="submit" className="btn btn-primary" disabled={inviteMutation.isPending}>
              Convidar
            </button>
          </form>
          {inviteMutation.isError && (
            <p className="text-error text-sm mt-2">Erro ao convidar utilizador.</p>
          )}
          {inviteMutation.isSuccess && (
            <p className="text-success text-sm mt-2">Convite enviado com sucesso.</p>
          )}
        </div>
      </div>

      {removeModal && (
        <dialog open role="dialog" aria-modal="true" className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Remover membro</h3>
            <p className="py-2">
              Tem a certeza que pretende remover este membro ({removeModal.role})?
            </p>
            {removeMutation.isError && (
              <p className="text-error text-sm">
                Não foi possível remover. Verifique se existe pelo menos um owner na equipa.
              </p>
            )}
            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={() => { setRemoveModal(null); removeMutation.reset() }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-error"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(removeModal.userId)}
              >
                Remover
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}
