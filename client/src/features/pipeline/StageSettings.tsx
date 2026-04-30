import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiFetch } from '../../lib/api'
import { stagesQueryOptions } from './api'
import type { PipelineStage } from '@shared/pipeline'

const CreateStageSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(255),
})

type CreateStageInput = z.infer<typeof CreateStageSchema>

interface ApiError {
  code?: string
  details?: { leadsAffected?: number }
}

interface DeleteModalState {
  stageId: string
  stageName: string
  leadsAffected: number
}

export function StageSettings() {
  const queryClient = useQueryClient()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState<DeleteModalState | null>(null)
  const [destinationStageId, setDestinationStageId] = useState<string>('')

  const { data } = useQuery(stagesQueryOptions)
  const stages = data?.stages ?? []

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateStageInput>({
    resolver: zodResolver(CreateStageSchema),
  })

  const createMutation = useMutation({
    mutationFn: ({ name }: CreateStageInput) =>
      apiFetch('/pipeline/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stagesQueryOptions.queryKey })
      reset()
    },
  })

  const reorderMutation = useMutation({
    mutationFn: ({ stageId, order }: { stageId: string; order: number }) =>
      apiFetch(`/pipeline/stages/${stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stagesQueryOptions.queryKey })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: ({
      stageId,
      destinationId,
    }: {
      stageId: string
      destinationId?: string
    }) => {
      const url = destinationId
        ? `/pipeline/stages/${stageId}?destinationStageId=${destinationId}`
        : `/pipeline/stages/${stageId}`
      return apiFetch(url, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stagesQueryOptions.queryKey })
      setDeleteModal(null)
      setDestinationStageId('')
    },
    onError: (
      error: unknown,
      variables: { stageId: string; destinationId?: string },
    ) => {
      const apiError = error as ApiError
      if (apiError.code === 'STAGE_HAS_LEADS') {
        const stage = stages.find((s) => s.id === variables.stageId)
        setDeleteModal({
          stageId: variables.stageId,
          stageName: stage?.name ?? '',
          leadsAffected: apiError.details?.leadsAffected ?? 0,
        })
      }
    },
  })

  function handleDrop(targetStage: PipelineStage) {
    if (!draggingId || draggingId === targetStage.id) return
    reorderMutation.mutate({ stageId: draggingId, order: targetStage.order })
    setDraggingId(null)
  }

  return (
    <div className="p-4 max-w-lg">
      <h2 className="text-lg font-semibold mb-4">Etapas do Pipeline</h2>

      <ul className="flex flex-col gap-2 mb-6">
        {stages.map((stage) => (
          <li
            key={stage.id}
            draggable
            onDragStart={() => setDraggingId(stage.id)}
            onDragEnd={() => setDraggingId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(stage)}
            className="flex items-center justify-between bg-base-100 border border-base-300 rounded p-3"
          >
            <span>{stage.name}</span>
            {!stage.isDefaultEntry && (
              <button
                type="button"
                className="btn btn-sm btn-error btn-outline"
                onClick={() => deleteMutation.mutate({ stageId: stage.id })}
                aria-label={`Apagar ${stage.name}`}
              >
                Apagar
              </button>
            )}
          </li>
        ))}
      </ul>

      <form
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        className="flex gap-2"
      >
        <div className="flex-1">
          <input
            {...register('name')}
            className="input input-bordered w-full"
            placeholder="Nova etapa..."
          />
          {errors.name && (
            <p className="text-error text-sm">{errors.name.message}</p>
          )}
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={createMutation.isPending}
        >
          Adicionar
        </button>
      </form>

      {deleteModal && (
        <dialog
          open
          role="dialog"
          aria-modal="true"
          className="modal modal-open"
        >
          <div className="modal-box">
            <h3 className="font-bold text-lg">
              Apagar etapa &ldquo;{deleteModal.stageName}&rdquo;
            </h3>
            <p className="py-2">
              Existem {deleteModal.leadsAffected} leads nesta etapa. Escolha uma
              etapa de destino:
            </p>
            <select
              className="select select-bordered w-full"
              value={destinationStageId}
              onChange={(e) => setDestinationStageId(e.target.value)}
            >
              <option value="">Selecionar etapa...</option>
              {stages
                .filter((s) => s.id !== deleteModal.stageId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setDeleteModal(null)
                  setDestinationStageId('')
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-error"
                disabled={!destinationStageId}
                onClick={() =>
                  deleteMutation.mutate({
                    stageId: deleteModal.stageId,
                    destinationId: destinationStageId,
                  })
                }
              >
                Confirmar
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}
