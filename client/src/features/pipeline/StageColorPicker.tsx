import { useState } from 'react'

const PALETTE = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

interface StageColorPickerProps {
  initialColor: string
  onApply: (color: string) => void
  onCancel: () => void
}

export function StageColorPicker({
  initialColor,
  onApply,
  onCancel,
}: StageColorPickerProps) {
  const [draft, setDraft] = useState(initialColor)
  const [custom, setCustom] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
              draft === color
                ? 'border-base-content scale-110'
                : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => setDraft(color)}
            aria-label={`Selecionar cor ${color}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="text-xs link"
          onClick={() => setCustom(!custom)}
        >
          {custom ? 'Usar paleta' : 'Cor personalizada'}
        </button>
        {custom && (
          <input
            type="color"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer"
          />
        )}
      </div>
      <div className="flex gap-2 justify-end pt-1 border-t border-base-200">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => onApply(draft)}
        >
          Aplicar
        </button>
      </div>
    </div>
  )
}
