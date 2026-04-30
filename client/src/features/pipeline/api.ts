import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import type {
  StageListResponse,
  LeadListResponse,
  CustomFieldListResponse,
  CreateLeadRequest,
  UpdateLeadRequest,
  CreateCustomFieldRequest,
  UpdateCustomFieldRequest,
  ReorderStagesRequest,
  UpdateStageRequest,
} from '@shared/pipeline'

export const stagesQueryKey = ['pipeline', 'stages'] as const
export const stagesQueryOptions = {
  queryKey: stagesQueryKey,
  queryFn: (): Promise<StageListResponse> => apiFetch('/pipeline/stages'),
}

export const leadsQueryKey = ['pipeline', 'leads'] as const
export const leadsQueryOptions = {
  queryKey: leadsQueryKey,
  queryFn: (): Promise<LeadListResponse> => apiFetch('/pipeline/leads'),
}

export const customFieldsQueryKey = ['pipeline', 'custom-fields'] as const
export const customFieldsQueryOptions = {
  queryKey: customFieldsQueryKey,
  queryFn: (): Promise<CustomFieldListResponse> =>
    apiFetch('/pipeline/custom-fields'),
}

export function useStages() {
  return useQuery(stagesQueryOptions)
}

export function useLeads() {
  return useQuery(leadsQueryOptions)
}

export function useCustomFields() {
  return useQuery<CustomFieldListResponse>({
    queryKey: customFieldsQueryKey,
    queryFn: () => apiFetch('/pipeline/custom-fields'),
  })
}

export function useCreateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateLeadRequest) =>
      apiFetch('/pipeline/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadsQueryKey })
    },
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      leadId,
      body,
    }: {
      leadId: string
      body: UpdateLeadRequest
    }) =>
      apiFetch(`/pipeline/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadsQueryKey })
    },
  })
}

export function useMoveLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ leadId, stageId }: { leadId: string; stageId: string }) =>
      apiFetch(`/pipeline/leads/${leadId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId }),
      }),
    onMutate: async ({ leadId, stageId }) => {
      await queryClient.cancelQueries({ queryKey: leadsQueryKey })
      const previousLeads =
        queryClient.getQueryData<LeadListResponse>(leadsQueryKey)
      queryClient.setQueryData(
        leadsQueryKey,
        (old: LeadListResponse | undefined) => {
          if (!old) return old
          return {
            ...old,
            leads: old.leads.map((l) =>
              l.id === leadId ? { ...l, stageId } : l,
            ),
          }
        },
      )
      return { previousLeads }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(leadsQueryKey, context?.previousLeads)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: leadsQueryKey })
    },
  })
}

export function useStageMutations() {
  const queryClient = useQueryClient()

  const createStage = useMutation({
    mutationFn: (name: string) =>
      apiFetch('/pipeline/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: stagesQueryKey }),
  })

  const updateStage = useMutation({
    mutationFn: ({
      stageId,
      body,
    }: {
      stageId: string
      body: UpdateStageRequest
    }) =>
      apiFetch(`/pipeline/stages/${stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: stagesQueryKey }),
  })

  const reorderStages = useMutation({
    mutationFn: (body: ReorderStagesRequest) =>
      apiFetch('/pipeline/stages/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: stagesQueryKey }),
  })

  const deleteStage = useMutation({
    mutationFn: ({
      stageId,
      destinationStageId,
    }: {
      stageId: string
      destinationStageId?: string
    }) => {
      const url = destinationStageId
        ? `/pipeline/stages/${stageId}?destinationStageId=${destinationStageId}`
        : `/pipeline/stages/${stageId}`
      return apiFetch(url, { method: 'DELETE' })
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: stagesQueryKey }),
  })

  return { createStage, updateStage, reorderStages, deleteStage }
}

export function useCustomFieldMutations() {
  const queryClient = useQueryClient()

  const createField = useMutation({
    mutationFn: (body: CreateCustomFieldRequest) =>
      apiFetch('/pipeline/custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: customFieldsQueryKey }),
  })

  const updateField = useMutation({
    mutationFn: ({
      fieldId,
      body,
    }: {
      fieldId: string
      body: UpdateCustomFieldRequest
    }) =>
      apiFetch(`/pipeline/custom-fields/${fieldId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: customFieldsQueryKey }),
  })

  const deleteField = useMutation({
    mutationFn: (fieldId: string) =>
      apiFetch(`/pipeline/custom-fields/${fieldId}`, { method: 'DELETE' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: customFieldsQueryKey }),
  })

  return { createField, updateField, deleteField }
}
