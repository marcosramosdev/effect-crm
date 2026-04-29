import { useState } from 'react'
import { Reorder, AnimatePresence } from 'framer-motion'
import { GripVertical, Trash2 } from 'lucide-react'
import { useStages, useStageMutations } from './api'
import { StageColorPicker } from './StageColorPicker'

interface DeleteState {
  stageId: string
  stageName: string
  leadsAffected: number
}

export function StageSettingsPanel() {
  const { data: stagesData } = useStages()
  const { updateStage, reorderStages, deleteStage } = useStageMutations()
  const stages = stagesData?.stages ?? []

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#64748b')
  const [editDescription, setEditDescription] = useState('')
  const [deleteModal, setDeleteModal] = useState<DeleteState | null>(null)
  const [destinationId, setDestinationId] = useState('')

  function startEdit(stage: (typeof stages)[number]) {
    setEditingId(stage.id)
    setEditName(stage.name)
    setEditColor(stage.color)
    setEditDescription(stage.description ?? '')
  }

  function saveEdit(stageId: string) {
    updateStage.mutate({
      stageId,
      body: {
        name: editName,
        color: editColor,
        description: editDescription || undefined,
      },
    })
    setEditingId(null)
  }

  function handleReorder(newOrder: typeof stages) {
    const payload = newOrder.map((s, i) => ({ id: s.id, order: i + 1 }))
    reorderStages.mutate({ stages: payload })
  }

  function handleDelete(stageId: string) {
    deleteStage.mutate(
      { stageId },
      {
        onError: (err) => {
          const error = err as {
            code?: string
            details?: { leadsAffected?: number }
          }
          if (error.code === 'STAGE_HAS_LEADS') {
            const stage = stages.find((s) => s.id === stageId)
            setDeleteModal({
              stageId,
              stageName: stage?.name ?? '',
              leadsAffected: error.details?.leadsAffected ?? 0,
            })
          }
        },
      },
    )
  }

  function confirmDelete() {
    if (!deleteModal) return
    deleteStage.mutate(
      {
        stageId: deleteModal.stageId,
        destinationStageId: destinationId || undefined,
      },
      {
        onSuccess: () => {
          setDeleteModal(null)
          setDestinationId('')
        },
      },
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Etapas</h3>

      <Reorder.Group
        axis="y"
        values={stages}
        onReorder={handleReorder}
        className="space-y-2"
      >
        {stages.map((stage) => (
          <Reorder.Item
            key={stage.id}
            value={stage}
            className="bg-base-100 border border-base-300 rounded-lg p-3"
          >
            {editingId === stage.id ? (
              <div className="space-y-3">
                <input
                  className="input input-bordered w-full"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome da etapa"
                />
                <StageColorPicker value={editColor} onChange={setEditColor} />
                <input
                  className="input input-bordered w-full"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Descrição opcional"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => saveEdit(stage.id)}
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setEditingId(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <GripVertical className="h-4 w-4 text-base-content/40 shrink-0 cursor-grab" />
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{stage.name}</p>
                    {stage.description && (
                      <p className="text-xs text-base-content/60 truncate">
                        {stage.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => startEdit(stage)}
                  >
                    Editar
                  </button>
                  {!stage.isDefaultEntry && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-square text-error"
                      onClick={() => handleDelete(stage.id)}
                      aria-label={`Apagar ${stage.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {deleteModal && (
        <dialog open className="modal modal-open">
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
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
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
                onClick={() => setDeleteModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-error"
                disabled={!destinationId}
                onClick={confirmDelete}
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
