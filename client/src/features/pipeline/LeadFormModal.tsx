import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { useCreateLead, useUpdateLead, useCustomFields } from './api'
import type { PipelineLead, CustomFieldDef } from '@shared/pipeline'

const LeadFormSchema = z.object({
  displayName: z.string().trim().max(255).optional().or(z.literal('')),
  phoneNumber: z.string().trim().optional().or(z.literal('')),
  stageId: z.string().uuid(),
  customValues: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.null()]).optional(),
  ),
})

type LeadFormInput = z.infer<typeof LeadFormSchema>

interface LeadFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  stageId?: string
  lead?: PipelineLead
  onClose: () => void
}

export function LeadFormModal({
  open,
  mode,
  stageId,
  lead,
  onClose,
}: LeadFormModalProps) {
  const { data: customFieldsData } = useCustomFields()
  const createLead = useCreateLead()
  const updateLead = useUpdateLead()

  const customFields = customFieldsData?.fields ?? []

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors },
    watch,
  } = useForm<LeadFormInput>({
    resolver: zodResolver(LeadFormSchema),
    defaultValues: {
      displayName: '',
      phoneNumber: '',
      stageId: stageId ?? '',
      customValues: {},
    },
  })

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && lead) {
        const customValues: Record<string, string | number | null> = {}
        if (lead.customValues) {
          for (const [key, value] of Object.entries(lead.customValues)) {
            customValues[key] = value
          }
        }
        reset({
          displayName: lead.displayName ?? '',
          phoneNumber: lead.phoneNumber.startsWith('manual:')
            ? ''
            : lead.phoneNumber,
          stageId: lead.stageId,
          customValues,
        })
      } else {
        reset({
          displayName: '',
          phoneNumber: '',
          stageId: stageId ?? '',
          customValues: {},
        })
      }
      clearErrors()
    }
  }, [open, mode, lead, stageId, reset, clearErrors])

  const onSubmit = (data: LeadFormInput) => {
    const payload = {
      displayName: data.displayName || undefined,
      phoneNumber: data.phoneNumber || undefined,
      stageId: data.stageId,
      customValues: data.customValues,
    }

    if (mode === 'create') {
      createLead.mutate(payload, {
        onSuccess: () => onClose(),
        onError: (err) => {
          const error = err as { code?: string; message?: string }
          if (error.code === 'LEAD_PHONE_EXISTS') {
            setError('phoneNumber', {
              message: 'Número de telefone já existe para este tenant',
            })
          }
        },
      })
    } else if (lead) {
      updateLead.mutate(
        { leadId: lead.id, body: payload },
        {
          onSuccess: () => onClose(),
          onError: (err) => {
            const error = err as { code?: string; message?: string }
            if (error.code === 'LEAD_PHONE_EXISTS') {
              setError('phoneNumber', {
                message: 'Número de telefone já existe para este tenant',
              })
            }
          },
        },
      )
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-lg p-6 shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {mode === 'create' ? 'Novo Lead' : 'Editar Lead'}
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <label htmlFor="displayName" className="label">
              <span className="label-text">Nome</span>
            </label>
            <input
              id="displayName"
              {...register('displayName')}
              className="input input-bordered w-full"
              placeholder="Nome do lead"
            />
            {errors.displayName && (
              <p className="text-error text-sm mt-1">
                {errors.displayName.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="phoneNumber" className="label">
              <span className="label-text">Telefone</span>
            </label>
            <input
              id="phoneNumber"
              {...register('phoneNumber')}
              className="input input-bordered w-full"
              placeholder="+351900000001"
            />
            {errors.phoneNumber && (
              <p className="text-error text-sm mt-1">
                {errors.phoneNumber.message}
              </p>
            )}
          </div>

          {customFields.map((field) => (
            <CustomFieldInput
              key={field.id}
              field={field}
              register={register}
              error={errors.customValues?.[field.id]?.message}
              value={watch(`customValues.${field.id}`)}
            />
          ))}

          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createLead.isPending || updateLead.isPending}
            >
              {createLead.isPending || updateLead.isPending ? (
                <span className="loading loading-spinner loading-sm" />
              ) : mode === 'create' ? (
                'Criar'
              ) : (
                'Guardar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CustomFieldInput({
  field,
  register,
  error,
}: {
  field: CustomFieldDef
  register: ReturnType<typeof useForm<LeadFormInput>>['register']
  error?: string
  value?: unknown
}) {
  const name = `customValues.${field.id}` as const

  return (
    <div>
      <label htmlFor={field.id} className="label">
        <span className="label-text">{field.label}</span>
      </label>
      {field.type === 'select' && field.options ? (
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
      ) : field.type === 'number' ? (
        <input
          id={field.id}
          type="number"
          {...register(name, { valueAsNumber: true })}
          className="input input-bordered w-full"
          placeholder={field.label}
        />
      ) : field.type === 'date' ? (
        <input
          id={field.id}
          type="date"
          {...register(name)}
          className="input input-bordered w-full"
        />
      ) : (
        <input
          id={field.id}
          type={field.type === 'url' ? 'url' : 'text'}
          {...register(name)}
          className="input input-bordered w-full"
          placeholder={field.label}
        />
      )}
      {error && <p className="text-error text-sm mt-1">{error}</p>}
    </div>
  )
}
