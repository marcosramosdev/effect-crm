import type { UseFormRegister } from 'react-hook-form'
import type { CustomFieldDef } from '@shared/pipeline'

type FieldValues = Record<string, unknown>

interface TypedFieldInputProps {
  field: CustomFieldDef
  register: UseFormRegister<FieldValues>
  value?: unknown
  onChange?: (value: string | number | boolean | null) => void
  error?: string
}

export function TypedFieldInput({
  field,
  register,
  value,
  onChange,
  error,
}: TypedFieldInputProps) {
  const name = `customValues.${field.id}`

  if (field.type === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <input
          id={field.id}
          type="checkbox"
          className="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <label htmlFor={field.id} className="label-text">
          {field.label}
        </label>
        {error && <p className="text-error text-sm">{error}</p>}
      </div>
    )
  }

  if (field.type === 'instagram') {
    return (
      <div>
        <label htmlFor={field.id} className="label">
          <span className="label-text">{field.label}</span>
        </label>
        <div className="input input-bordered flex items-center w-full">
          <span className="text-base-content/50 mr-1 select-none">@</span>
          <input
            id={field.id}
            type="text"
            className="flex-1 outline-none bg-transparent"
            placeholder="username"
            value={typeof value === 'string' ? value.replace(/^@/, '') : ''}
            onChange={(e) => onChange?.(e.target.value.replace(/^@/, ''))}
          />
        </div>
        {error && <p className="text-error text-sm mt-1">{error}</p>}
      </div>
    )
  }

  if (field.type === 'select' && field.options) {
    return (
      <div>
        <label htmlFor={field.id} className="label">
          <span className="label-text">{field.label}</span>
        </label>
        <select
          id={field.id}
          {...register(name)}
          className="select select-bordered w-full"
        >
          <option value="">Selecionar...</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {error && <p className="text-error text-sm mt-1">{error}</p>}
      </div>
    )
  }

  const inputType =
    field.type === 'email'
      ? 'email'
      : field.type === 'number'
        ? 'number'
        : field.type === 'date'
          ? 'date'
          : field.type === 'url'
            ? 'url'
            : 'text'

  const registerOpts = field.type === 'number' ? { valueAsNumber: true } : {}

  return (
    <div>
      <label htmlFor={field.id} className="label">
        <span className="label-text">{field.label}</span>
      </label>
      <input
        id={field.id}
        type={inputType}
        {...register(name, registerOpts)}
        className="input input-bordered w-full"
        placeholder={field.label}
      />
      {error && <p className="text-error text-sm mt-1">{error}</p>}
    </div>
  )
}
