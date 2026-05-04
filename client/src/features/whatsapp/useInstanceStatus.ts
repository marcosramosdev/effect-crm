import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateInstanceBody, InstanceStatusDTO } from '@shared/whatsapp'
import {
  connectInstance,
  createInstance,
  deleteInstance,
  getInstanceStatus,
} from './api'

export const instanceStatusQueryKey = ['whatsapp', 'instance-status'] as const

export const instanceStatusQueryOptions = {
  queryKey: instanceStatusQueryKey,
  queryFn: getInstanceStatus,
  refetchInterval: (query: { state: { data?: InstanceStatusDTO } }) => {
    const status = query.state.data?.status
    return status === 'qr_pending' || status === 'connecting' ? 3000 : false
  },
}

export function useInstanceStatus() {
  return useQuery(instanceStatusQueryOptions)
}

export function useCreateInstance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateInstanceBody) => createInstance(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: instanceStatusQueryKey })
    },
  })
}

export function useConnectInstance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: connectInstance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: instanceStatusQueryKey })
    },
  })
}

export function useDeleteInstance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteInstance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: instanceStatusQueryKey })
    },
  })
}
