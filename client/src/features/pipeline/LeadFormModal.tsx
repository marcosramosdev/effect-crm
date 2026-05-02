import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import {
  useCreateLead,
  useUpdateLead,
  useCustomFields,
  useStages,
  useMoveLead,
} from './api'
import { TypedFieldInput } from './TypedFieldInput'
import type { PipelineLead } from '@shared/pipeline'

const LeadFormSchema = z.object({
  displayName: z.string().trim().max(255).optional().or(z.literal('')),
  phoneNumber: z.string().trim().optional().or(z.literal('')),
  stageId: z.string().uuid(),
  customValues: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  ),
})

type LeadFormInput = z.infer<typeof LeadFormSchema>

interface LeadFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  stageId?: string
  lead?: PipelineLead
  onClose: () => void
  triggerRef?: React.RefObject<HTMLElement | null>
}

export function LeadFormModal({
  open,
  mode,
  stageId,
  lead,
  onClose,
  triggerRef,
}: LeadFormModalProps) {
  const { data: customFieldsData } = useCustomFields()
  const { data: stagesData } = useStages()
  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  const moveLead = useMoveLead()
  const modalRef = useRef<HTMLDivElement>(null)

  const customFields = customFieldsData?.fields ?? []
  const stages = stagesData?.stages ?? []

  // Track typed field values for uncontrolled fields (checkbox, instagram)
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, unknown>>(
    {},
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    watch,
    formState: { errors },
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
      const overrides: Record<string, unknown> = {}
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
        // Pre-populate overrides for checkbox/instagram
        for (const field of customFields) {
          if (field.type === 'checkbox' || field.type === 'instagram') {
            overrides[field.id] =
              lead.customValues?.[field.id] ??
              (field.type === 'checkbox' ? false : '')
          }
        }
      } else {
        reset({
          displayName: '',
          phoneNumber: '',
          stageId: stageId ?? '',
          customValues: {},
        })
        for (const field of customFields) {
          if (field.type === 'checkbox') overrides[field.id] = false
          if (field.type === 'instagram') overrides[field.id] = ''
        }
      }
      setFieldOverrides(overrides)
      setFieldErrors({})
      clearErrors()
    }
  }, [open, mode, lead, stageId, reset, clearErrors, customFields])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open && triggerRef?.current) {
      triggerRef.current.focus()
    }
  }, [open, triggerRef])

  const onSubmit = (data: LeadFormInput) => {
    const emailErrs: Record<string, string> = {}
    for (const field of customFields) {
      if (field.type === 'email') {
        const val = data.customValues[field.id]
        if (
          val &&
          typeof val === 'string' &&
          !z.email().safeParse(val).success
        ) {
          emailErrs[field.id] = 'Email inválido'
        }
      }
    }
    setFieldErrors(emailErrs)
    if (Object.keys(emailErrs).length > 0) return

    const originalStageId = lead?.stageId
    const newStageId = data.stageId

    // Merge checkbox/instagram overrides into customValues
    const customValues: Record<string, unknown> = { ...data.customValues }
    for (const [fieldId, val] of Object.entries(fieldOverrides)) {
      customValues[fieldId] = val
    }
    // Strip @ from instagram fields before save
    for (const field of customFields) {
      if (
        field.type === 'instagram' &&
        typeof customValues[field.id] === 'string'
      ) {
        customValues[field.id] = (customValues[field.id] as string).replace(
          /^@/,
          '',
        )
      }
    }

    const payload = {
      displayName: data.displayName || undefined,
      phoneNumber: data.phoneNumber || undefined,
      stageId: newStageId,
      customValues: customValues as Record<
        string,
        string | number | boolean | null
      >,
    }

    if (mode === 'create') {
      createLead.mutate(payload, {
        onSuccess: () => onClose(),
        onError: (err) => {
          const error = err as { code?: string }
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
          onSuccess: () => {
            // If stage changed, also fire the move mutation
            if (originalStageId && newStageId !== originalStageId) {
              moveLead.mutate({ leadId: lead.id, stageId: newStageId })
            }
            onClose()
          },
          onError: (err) => {
            const error = err as { code?: string }
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

  const isPending = createLead.isPending || updateLead.isPending

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-white border border-base-200 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
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

          {/* Stage selector */}
          <div>
            <label htmlFor="stageId" className="label">
              <span className="label-text">Etapa</span>
            </label>
            <select
              id="stageId"
              {...register('stageId')}
              className="select select-bordered w-full"
            >
              <option value="">Selecionar etapa...</option>
              {[...stages]
                .sort((a, b) => a.order - b.order)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            {errors.stageId && (
              <p className="text-error text-sm mt-1">
                {errors.stageId.message}
              </p>
            )}
          </div>

          {/* Typed custom fields */}
          {customFields.map((field) => {
            const needsOverride =
              field.type === 'checkbox' || field.type === 'instagram'
            return (
              <TypedFieldInput
                key={field.id}
                field={field}
                register={
                  register as unknown as UseFormRegister<
                    Record<string, unknown>
                  >
                }
                value={
                  needsOverride
                    ? fieldOverrides[field.id]
                    : watch(`customValues.${field.id}`)
                }
                onChange={
                  needsOverride
                    ? (val) =>
                        setFieldOverrides((p) => ({ ...p, [field.id]: val }))
                    : undefined
                }
                error={
                  errors.customValues?.[field.id]?.message ??
                  fieldErrors[field.id]
                }
              />
            )
          })}

          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isPending}
            >
              {isPending ? (
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
