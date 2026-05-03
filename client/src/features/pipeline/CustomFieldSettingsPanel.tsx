import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Trash2, GripVertical } from 'lucide-react'
import { useCustomFields, useCustomFieldMutations } from './api'
import type { CustomFieldDef } from '@shared/pipeline'

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Seleção' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefone' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'checkbox', label: 'Checkbox' },
] as const

const CreateFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, 'Chave obrigatória')
    .max(50)
    .regex(/^[a-z_][a-z0-9_]*$/, 'Apenas letras minúsculas, números e _'),
  label: z.string().trim().min(1, 'Label obrigatório').max(255),
  type: z.enum([
    'text',
    'number',
    'date',
    'select',
    'url',
    'email',
    'phone',
    'instagram',
    'checkbox',
  ]),
})

type CreateFieldInput = z.infer<typeof CreateFieldSchema>

interface CustomFieldSettingsPanelProps {
  open: boolean
  onClose: () => void
}

export function CustomFieldSettingsPanel({
  open,
  onClose,
}: CustomFieldSettingsPanelProps) {
  const { data } = useCustomFields()
  const fields = data?.fields ?? []
  const { createField, updateField, deleteField } = useCustomFieldMutations()
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateFieldInput>({
    resolver: zodResolver(CreateFieldSchema),
    defaultValues: { type: 'text' },
  })

  function handleDrop(target: CustomFieldDef) {
    if (!draggingId || draggingId === target.id) return
    updateField.mutate({ fieldId: draggingId, body: { order: target.order } })
    setDraggingId(null)
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-base-100 border-l border-base-300 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Campos personalizados"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-200">
          <h2 className="text-lg font-semibold">Campos personalizados</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            onClick={onClose}
            aria-label="Fechar painel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          <ul className="flex flex-col gap-2">
            {fields.map((field) => (
              <li
                key={field.id}
                draggable
                onDragStart={() => setDraggingId(field.id)}
                onDragEnd={() => setDraggingId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(field)}
                className="flex items-center gap-2 bg-base-100 border border-base-200 rounded-lg p-3"
              >
                <GripVertical className="h-4 w-4 text-base-content/40 cursor-grab flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{field.label}</span>
                  <span className="ml-2 text-xs text-base-content/50">
                    {field.type}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-square text-error"
                  aria-label={`Apagar ${field.label}`}
                  onClick={() => deleteField.mutate(field.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
            {fields.length === 0 && (
              <p className="text-sm text-base-content/50 text-center py-4">
                Nenhum campo criado ainda.
              </p>
            )}
          </ul>

          <form
            onSubmit={handleSubmit((values) =>
              createField.mutate(values, {
                onSuccess: () => reset({ type: 'text' }),
              }),
            )}
            className="flex flex-col gap-3 border-t border-base-200 pt-4"
          >
            <h3 className="text-sm font-semibold">Novo campo</h3>

            <div>
              <label htmlFor="cf-key" className="label">
                <span className="label-text">Chave</span>
              </label>
              <input
                id="cf-key"
                {...register('key')}
                className="input input-bordered input-sm w-full"
                placeholder="ex: empresa"
              />
              {errors.key && (
                <p className="text-error text-xs mt-1">{errors.key.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="cf-label" className="label">
                <span className="label-text">Label</span>
              </label>
              <input
                id="cf-label"
                {...register('label')}
                className="input input-bordered input-sm w-full"
                placeholder="ex: Empresa"
              />
              {errors.label && (
                <p className="text-error text-xs mt-1">
                  {errors.label.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="cf-type" className="label">
                <span className="label-text">Tipo</span>
              </label>
              <select
                id="cf-type"
                {...register('type')}
                className="select select-bordered select-sm w-full"
              >
                {FIELD_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={createField.isPending}
            >
              {createField.isPending ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                'Criar campo'
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
