import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'
import type { StageListResponse, LeadListResponse } from '@shared/pipeline'

export const stagesQueryOptions = {
  queryKey: ['pipeline', 'stages'] as const,
  queryFn: (): Promise<StageListResponse> => apiFetch('/pipeline/stages'),
}

export const leadsQueryOptions = {
  queryKey: ['pipeline', 'leads'] as const,
  queryFn: (): Promise<LeadListResponse> => apiFetch('/pipeline/leads'),
}

export function PipelineBoard() {
  const queryClient = useQueryClient()
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null)

  const { data: stagesData, isLoading: stagesLoading } = useQuery(stagesQueryOptions)
  const { data: leadsData, isLoading: leadsLoading } = useQuery(leadsQueryOptions)

  const moveMutation = useMutation({
    mutationFn: ({ leadId, stageId }: { leadId: string; stageId: string }) =>
      apiFetch(`/pipeline/leads/${leadId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId }),
      }),
    onMutate: async ({ leadId, stageId }) => {
      await queryClient.cancelQueries({ queryKey: leadsQueryOptions.queryKey })
      const previousLeads = queryClient.getQueryData(leadsQueryOptions.queryKey)
      queryClient.setQueryData(leadsQueryOptions.queryKey, (old: LeadListResponse | undefined) => {
        if (!old) return old
        return {
          ...old,
          leads: old.leads.map((l) => (l.id === leadId ? { ...l, stageId } : l)),
        }
      })
      return { previousLeads }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(leadsQueryOptions.queryKey, context?.previousLeads)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: leadsQueryOptions.queryKey })
    },
  })

  if (stagesLoading || leadsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="loading loading-spinner loading-md" />
      </div>
    )
  }

  const stages = stagesData?.stages ?? []
  const leads = leadsData?.leads ?? []

  return (
    <div className="flex gap-4 p-4 overflow-x-auto h-full">
      {stages.map((stage) => {
        const stageLeads = leads.filter((l) => l.stageId === stage.id)
        return (
          <div key={stage.id} className="flex flex-col w-64 shrink-0 bg-base-200 rounded-lg">
            <div className="px-3 py-2 font-semibold border-b border-base-300">
              {stage.name}
              <span className="ml-2 badge badge-sm">{stageLeads.length}</span>
            </div>
            <ul
              role="list"
              aria-label={stage.name}
              className="flex flex-col gap-2 p-2 flex-1 min-h-16"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (draggingLeadId) {
                  moveMutation.mutate({ leadId: draggingLeadId, stageId: stage.id })
                  setDraggingLeadId(null)
                }
              }}
            >
              {stageLeads.map((lead) => (
                <li
                  key={lead.id}
                  className="bg-base-100 rounded p-2 shadow-sm cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={() => setDraggingLeadId(lead.id)}
                  onDragEnd={() => setDraggingLeadId(null)}
                >
                  <div className="font-medium text-sm truncate">
                    {lead.displayName ?? lead.phoneNumber}
                  </div>
                  <div className="text-xs text-base-content/60">{lead.phoneNumber}</div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
