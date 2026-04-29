import { useState } from 'react'
import { Reorder } from 'framer-motion'
import { Trash2, GripVertical } from 'lucide-react'
import { useCustomFields, useCustomFieldMutations } from './api'

export function CustomFieldSettingsPanel() {
  const { data: customFieldsData } = useCustomFields()
  const { createField, updateField, deleteField } = useCustomFieldMutations()
  const fields = customFieldsData?.fields ?? []

  const [isCreating, setIsCreating] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<
    'text' | 'number' | 'date' | 'select' | 'url'
  >('text')
  const [newOptions, setNewOptions] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editOptions, setEditOptions] = useState('')

  function handleCreate() {
    const options =
      newType === 'select'
        ? newOptions
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined
    createField.mutate(
      { key: newKey, label: newLabel, type: newType, options },
      {
        onSuccess: () => {
          setIsCreating(false)
          setNewKey('')
          setNewLabel('')
          setNewType('text')
          setNewOptions('')
        },
        onError: (err) => {
          const error = err as { code?: string }
          if (error.code === 'CUSTOM_FIELDS_LIMIT') {
            alert('Limite de 20 campos personalizados atingido.')
          }
        },
      },
    )
  }

  function handleReorder(newOrder: typeof fields) {
    const payload = newOrder.map((f, i) => ({ id: f.id, order: i }))
    for (const p of payload) {
      updateField.mutate({ fieldId: p.id, body: { order: p.order } })
    }
  }

  function startEdit(field: (typeof fields)[number]) {
    setEditingId(field.id)
    setEditLabel(field.label)
    setEditOptions(field.options?.join(', ') ?? '')
  }

  function saveEdit(fieldId: string) {
    const options = editOptions
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
    updateField.mutate(
      { fieldId, body: { label: editLabel, options } },
      { onSuccess: () => setEditingId(null) },
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Campos personalizados</h3>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => setIsCreating(!isCreating)}
        >
          {isCreating ? 'Cancelar' : 'Adicionar'}
        </button>
      </div>

      {isCreating && (
        <div className="bg-base-100 border border-base-300 rounded-lg p-4 space-y-3">
          <input
            className="input input-bordered w-full"
            placeholder="Chave (ex: company)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <input
            className="input input-bordered w-full"
            placeholder="Etiqueta (ex: Empresa)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <select
            className="select select-bordered w-full"
            value={newType}
            onChange={(e) => setNewType(e.target.value as typeof newType)}
          >
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="date">Data</option>
            <option value="select">Seleção</option>
            <option value="url">URL</option>
          </select>
          {newType === 'select' && (
            <input
              className="input input-bordered w-full"
              placeholder="Opções separadas por vírgula"
              value={newOptions}
              onChange={(e) => setNewOptions(e.target.value)}
            />
          )}
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleCreate}
          >
            Criar campo
          </button>
        </div>
      )}

      <Reorder.Group
        axis="y"
        values={fields}
        onReorder={handleReorder}
        className="space-y-2"
      >
        {fields.map((field) => (
          <Reorder.Item
            key={field.id}
            value={field}
            className="bg-base-100 border border-base-300 rounded-lg p-3"
          >
            {editingId === field.id ? (
              <div className="space-y-3">
                <input
                  className="input input-bordered w-full"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="Etiqueta"
                />
                {field.type === 'select' && (
                  <input
                    className="input input-bordered w-full"
                    placeholder="Opções separadas por vírgula"
                    value={editOptions}
                    onChange={(e) => setEditOptions(e.target.value)}
                  />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => saveEdit(field.id)}
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
                  <div className="min-w-0">
                    <p className="font-medium truncate">{field.label}</p>
                    <p className="text-xs text-base-content/60">
                      {field.key} · {field.type}
                      {field.options ? ` · [${field.options.join(', ')}]` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => startEdit(field)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square text-error"
                    onClick={() => {
                      if (confirm(`Eliminar campo "${field.label}"?`)) {
                        deleteField.mutate(field.id)
                      }
                    }}
                    aria-label={`Apagar ${field.label}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  )
}
