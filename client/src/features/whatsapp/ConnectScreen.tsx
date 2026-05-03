import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { CheckCircle2, AlertCircle, Smartphone, Wifi } from 'lucide-react'
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
  const { data: connection, isLoading: connectionLoading } = useQuery(
    connectionQueryOptions,
  )

  const connectMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ status: string; qr: string | null }>('/whatsapp/connection', {
        method: 'POST',
      }),
    onSuccess: (data) => {
      queryClient.setQueryData<ConnectionData>(
        connectionQueryOptions.queryKey,
        (old) => ({
          status: data.status as ConnectionStatus,
          qr: data.qr,
          phoneNumber: old?.phoneNumber ?? null,
          lastHeartbeatAt: old?.lastHeartbeatAt ?? null,
          lastError: old?.lastError ?? null,
        }),
      )
    },
  })

  useEffect(() => {
    if (!auth?.tenantId) return

    const channel = supabase
      .channel('whatsapp-status')

      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_sessions_public',
          filter: `tenant_id=eq.${auth.tenantId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          queryClient.setQueryData<ConnectionData>(
            connectionQueryOptions.queryKey,
            (old) => ({
              status:
                (payload.new.status as ConnectionStatus | undefined) ??
                old?.status ??
                'disconnected',
              phoneNumber:
                (payload.new.phone_number as string | null) ??
                old?.phoneNumber ??
                null,
              lastHeartbeatAt:
                (payload.new.last_heartbeat_at as string | null) ??
                old?.lastHeartbeatAt ??
                null,
              lastError:
                (payload.new.last_error as string | null) ??
                old?.lastError ??
                null,
            }),
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [auth?.tenantId, queryClient])

  if (authLoading || connectionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  const status = connection?.status ?? 'disconnected'
  const qr = connection?.qr ?? null
  const isOwner = auth?.role === 'owner'

  return (
    <div className="relative max-w-3xl mx-auto py-10 px-4 anim-fade-up">
      <div className="surface-elevated rounded-3xl p-8 sm:p-10 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/12 blur-3xl"
        />
        <div className="relative flex items-center gap-3 mb-6">
          <span className="w-11 h-11 rounded-2xl bg-success/15 text-success flex items-center justify-center">
            <Wifi className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display font-bold text-2xl tracking-tight">
              Conexão com o WhatsApp
            </h1>
            <p className="text-sm text-base-content/60">
              Conecte o número da sua empresa para receber e responder mensagens
              direto pelo CRM.
            </p>
          </div>
        </div>

        {status === 'connected' && (
          <div className="relative flex flex-col items-start gap-3 p-5 rounded-2xl border border-success/30 bg-success/8">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="font-semibold text-success">
                WhatsApp conectado
              </span>
            </div>
            {connection?.phoneNumber && (
              <p className="text-sm text-base-content/70">
                Número ativo:{' '}
                <span className="font-mono font-medium text-base-content">
                  {connection.phoneNumber}
                </span>
              </p>
            )}
            <p className="text-xs text-base-content/55">
              As conversas chegam na caixa de entrada em tempo real.
            </p>
          </div>
        )}

        {status === 'qr_pending' && qr && (
          <div className="relative grid sm:grid-cols-[auto_1fr] gap-6 items-center">
            <div className="relative p-4 rounded-2xl bg-base-100 ring-1 ring-base-200 shadow-md">
              <img
                src={qr}
                alt="QR Code"
                className="h-56 w-56 rounded-lg block"
              />
              <span className="absolute -top-2 -right-2 chip chip-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary anim-pulse-soft" />
                Aguardando
              </span>
            </div>
            <ol className="space-y-3 text-sm text-base-content/75 list-decimal list-inside">
              <li>Abra o WhatsApp no seu celular.</li>
              <li>
                Vá em <span className="font-semibold">Configurações</span> →{' '}
                <span className="font-semibold">Aparelhos conectados</span>.
              </li>
              <li>
                Toque em <span className="font-semibold">Conectar aparelho</span>{' '}
                e escaneie este QR code.
              </li>
              <li>Pronto — as conversas começam a entrar automaticamente.</li>
            </ol>
          </div>
        )}

        {status === 'connecting' && (
          <div className="relative flex flex-col items-center gap-4 py-10">
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="text-base-content/70">Conectando ao WhatsApp…</p>
          </div>
        )}

        {(status === 'disconnected' || status === 'error') && (
          <div className="relative flex flex-col items-start gap-4 p-5 rounded-2xl border border-base-200 bg-base-200/50">
            <div className="flex items-center gap-2.5">
              {status === 'error' ? (
                <AlertCircle className="h-5 w-5 text-error" />
              ) : (
                <Smartphone className="h-5 w-5 text-base-content/55" />
              )}
              <span className="font-semibold">
                {status === 'error'
                  ? 'Erro na conexão'
                  : 'WhatsApp desconectado'}
              </span>
            </div>
            <p className="text-sm text-base-content/65">
              {status === 'error'
                ? 'Algo deu errado ao conectar. Tente novamente em instantes.'
                : 'Seu número não está vinculado ainda. Conecte para começar a receber mensagens.'}
            </p>
            {status === 'error' && connection?.lastError && (
              <p className="text-xs text-error font-mono bg-error/8 px-2 py-1 rounded-md">
                {connection.lastError}
              </p>
            )}
            {isOwner && (
              <button
                type="button"
                className="btn btn-primary rounded-full px-5 mt-1 gap-1.5"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
              >
                {connectMutation.isPending
                  ? 'Conectando…'
                  : status === 'error'
                    ? 'Reconectar'
                    : 'Conectar agora'}
              </button>
            )}
            {!isOwner && (
              <p className="text-xs text-base-content/50">
                Apenas o proprietário da conta pode conectar o WhatsApp.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
