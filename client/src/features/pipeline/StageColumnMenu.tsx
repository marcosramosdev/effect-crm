import { useState, useRef, useEffect } from 'react'
import { MoreVertical } from 'lucide-react'
import { useStageMutations } from './api'
import { StageColorPicker } from './StageColorPicker'
import type { PipelineStage } from '@shared/pipeline'

interface StageColumnMenuProps {
  stage: PipelineStage
  stages: PipelineStage[]
  onRename: () => void
}

export function StageColumnMenu({
  stage,
  stages,
  onRename,
}: StageColumnMenuProps) {
  const [open, setOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{
    leadsAffected: number
  } | null>(null)
  const [destinationId, setDestinationId] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  const { updateStage, deleteStage } = useStageMutations()

  useEffect(() => {
    if (!open) {
      setColorOpen(false)
    }
  }, [open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (colorOpen) return
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (colorOpen) {
          setColorOpen(false)
        } else {
          setOpen(false)
        }
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, colorOpen])

  function handleColorApply(color: string) {
    updateStage.mutate({ stageId: stage.id, body: { color } })
    setColorOpen(false)
    setOpen(false)
  }

  function handleColorCancel() {
    setColorOpen(false)
  }

  function handleDeleteClick() {
    deleteStage.mutate(
      { stageId: stage.id },
      {
        onSuccess: () => setOpen(false),
        onError: (err) => {
          const error = err as {
            code?: string
            details?: { leadsAffected?: number }
          }
          if (error.code === 'STAGE_HAS_LEADS') {
            setDeleteModal({ leadsAffected: error.details?.leadsAffected ?? 0 })
          }
        },
      },
    )
  }

  function confirmDelete() {
    if (!deleteModal) return
    deleteStage.mutate(
      { stageId: stage.id, destinationStageId: destinationId || undefined },
      {
        onSuccess: () => {
          setDeleteModal(null)
          setDestinationId('')
          setOpen(false)
        },
      },
    )
  }

  return (
    <>
      <div className="dropdown dropdown-end" ref={menuRef}>
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square"
          aria-label={`Opções de ${stage.name}`}
          onClick={() => setOpen((o) => !o)}
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {open && (
          <div className="dropdown-content z-30 mt-1 bg-base-100 border border-base-300 rounded-xl shadow-lg min-w-[9rem]">
            <ul className="menu menu-sm p-1">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onRename()
                    setOpen(false)
                  }}
                >
                  Renomear
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setColorOpen((v) => !v)}>
                  Alterar cor
                </button>
              </li>
            </ul>
            {colorOpen && (
              <div className="px-3 py-2 border-t border-base-300">
                <StageColorPicker
                  initialColor={stage.color}
                  onApply={handleColorApply}
                  onCancel={handleColorCancel}
                />
              </div>
            )}
            {!stage.isDefaultEntry && (
              <ul className="menu menu-sm p-1 border-t border-base-300">
                <li>
                  <button
                    type="button"
                    className="text-error"
                    onClick={handleDeleteClick}
                  >
                    Eliminar
                  </button>
                </li>
              </ul>
            )}
          </div>
        )}
      </div>

      {deleteModal && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">
              Eliminar etapa &ldquo;{stage.name}&rdquo;
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
                .filter((s) => s.id !== stage.id)
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
                  setDestinationId('')
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-error"
                disabled={!destinationId || deleteStage.isPending}
                onClick={confirmDelete}
              >
                Confirmar
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  )
}
