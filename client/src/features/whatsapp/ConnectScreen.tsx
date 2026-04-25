import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiFetch } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { ConnectionStatus } from '@shared/whatsapp'

type ConnectionData = {
  status: ConnectionStatus
  phoneNumber: string | null
  lastHeartbeatAt: string | null
  lastError: string | null
  qr?: string | null
}

export const connectionQueryOptions = {
  queryKey: ['whatsapp', 'connection'] as const,
  queryFn: (): Promise<ConnectionData> => apiFetch('/whatsapp/connection'),
}

export function ConnectScreen() {
  const queryClient = useQueryClient()
  const { data: auth, isLoading: authLoading } = useAuth()
  const { data: connection, isLoading: connectionLoading } = useQuery(connectionQueryOptions)

  const connectMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ status: string; qr: string | null }>('/whatsapp/connection', {
        method: 'POST',
      }),
    onSuccess: (data) => {
      queryClient.setQueryData<ConnectionData>(connectionQueryOptions.queryKey, (old) => ({
        status: data.status as ConnectionStatus,
        qr: data.qr,
        phoneNumber: old?.phoneNumber ?? null,
        lastHeartbeatAt: old?.lastHeartbeatAt ?? null,
        lastError: old?.lastError ?? null,
      }))
    },
  })

  useEffect(() => {
    if (!auth?.tenantId) return

    const channel = supabase
      .channel('whatsapp-status')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_sessions_public',
        filter: `tenant_id=eq.${auth.tenantId}`,
      }, (payload: { new: Record<string, unknown> }) => {
        queryClient.setQueryData<ConnectionData>(connectionQueryOptions.queryKey, (old) => ({
          status: (payload.new.status as ConnectionStatus) ?? old?.status ?? 'disconnected',
          phoneNumber: (payload.new.phone_number as string | null) ?? old?.phoneNumber ?? null,
          lastHeartbeatAt: (payload.new.last_heartbeat_at as string | null) ?? old?.lastHeartbeatAt ?? null,
          lastError: (payload.new.last_error as string | null) ?? old?.lastError ?? null,
        }))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [auth?.tenantId, queryClient])

  if (authLoading || connectionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  const status = connection?.status ?? 'disconnected'
  const qr = connection?.qr ?? null
  const isOwner = auth?.role === 'owner'

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <h1 className="text-2xl font-bold">WhatsApp Connection</h1>

      {status === 'connected' && (
        <div className="text-center">
          <div className="badge badge-success gap-2 p-4 text-base">Connected</div>
          {connection?.phoneNumber && (
            <p className="mt-2 text-sm text-base-content/70">{connection.phoneNumber}</p>
          )}
        </div>
      )}

      {status === 'qr_pending' && qr && (
        <div className="text-center">
          <p className="mb-4 text-sm">Scan the QR code with your phone</p>
          <img src={qr} alt="QR Code" className="h-64 w-64 rounded-lg border" />
        </div>
      )}

      {status === 'connecting' && (
        <div className="text-center">
          <span className="loading loading-spinner loading-lg" />
          <p className="mt-2">Connecting...</p>
        </div>
      )}

      {(status === 'disconnected' || status === 'error') && (
        <>
          <p className="text-base-content/70">
            {status === 'error' ? 'Connection error' : 'WhatsApp is disconnected'}
          </p>
          {status === 'error' && connection?.lastError && (
            <p className="text-sm text-error">{connection.lastError}</p>
          )}
          {isOwner && (
            <button
              className="btn btn-primary"
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending
                ? 'Connecting...'
                : status === 'error'
                  ? 'Reconnect'
                  : 'Connect'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
