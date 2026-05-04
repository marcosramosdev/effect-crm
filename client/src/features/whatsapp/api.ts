import { apiFetch } from '../../lib/api'
import {
  CreateInstanceResponseSchema,
  ConnectInstanceResponseSchema,
  InstanceStatusDTOSchema,
} from '@shared/whatsapp'
import type {
  CreateInstanceBody,
  ConnectInstanceResponse,
  CreateInstanceResponse,
  InstanceStatusDTO,
} from '@shared/whatsapp'

export function getInstanceStatus() {
  return apiFetch<InstanceStatusDTO>(
    '/whatsapp/instance/status',
    undefined,
    InstanceStatusDTOSchema,
  )
}

export function createInstance(body: CreateInstanceBody) {
  return apiFetch<CreateInstanceResponse>(
    '/whatsapp/instance',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    CreateInstanceResponseSchema,
  )
}

export function deleteInstance() {
  return apiFetch<void>('/whatsapp/instance', { method: 'DELETE' })
}

export function connectInstance() {
  return apiFetch<ConnectInstanceResponse>(
    '/whatsapp/instance/connect',
    { method: 'POST' },
    ConnectInstanceResponseSchema,
  )
}
