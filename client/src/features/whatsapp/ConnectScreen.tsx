import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  Link2Off,
  QrCode,
  RefreshCcw,
  Smartphone,
  Trash2,
  Wifi,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  instanceStatusQueryKey,
  useConnectInstance,
  useCreateInstance,
  useDeleteInstance,
  useInstanceStatus,
} from './useInstanceStatus'
import type { ConnectionStatus, InstanceStatusDTO } from '@shared/whatsapp'

type UiState =
  | 'no_instance'
  | 'disconnected'
  | 'qr_pending_valid'
  | 'qr_pending_expired'
  | 'connecting'
  | 'connected'
  | 'error'

function formatPhonePtBr(phoneNumber: string | null): string | null {
  if (!phoneNumber) return null
  const digits = phoneNumber.replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4)
    const first = digits.slice(4, 9)
    const second = digits.slice(9, 13)
    return `+55 (${ddd}) ${first}-${second}`
  }
  return phoneNumber.startsWith('+') ? phoneNumber : `+${digits}`
}

function formatRemaining(totalSeconds: number): string {
  const safe = Math.max(totalSeconds, 0)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function getUiState(
  status: ConnectionStatus,
  instanceName: string | null,
  qrExpiresAt: string | null,
): UiState {
  if (status === 'disconnected')
    return instanceName ? 'disconnected' : 'no_instance'
  if (status === 'qr_pending') {
    if (!qrExpiresAt) return 'qr_pending_expired'
    return new Date(qrExpiresAt).getTime() > Date.now()
      ? 'qr_pending_valid'
      : 'qr_pending_expired'
  }
  if (status === 'connecting') return 'connecting'
  if (status === 'connected') return 'connected'
  return 'error'
}

export function ConnectScreen() {
  const queryClient = useQueryClient()
  const deleteDialogRef = useRef<HTMLDialogElement | null>(null)
  const { data: auth, isLoading: authLoading } = useAuth()
  const { data: statusData, isLoading: statusLoading } = useInstanceStatus()
  const createInstanceMutation = useCreateInstance()
  const connectInstanceMutation = useConnectInstance()
  const deleteInstanceMutation = useDeleteInstance()

  const [instanceNameInput, setInstanceNameInput] = useState('')
  const [localQr, setLocalQr] = useState<string | null>(null)
  const [localQrExpiresAt, setLocalQrExpiresAt] = useState<string | null>(null)
  const [countdownSeconds, setCountdownSeconds] = useState(0)

  const isOwner = auth?.role === 'owner'
  const tenantName = auth?.tenantName ?? ''
  const status = statusData?.status ?? 'disconnected'

  useEffect(() => {
    setInstanceNameInput((prev) => {
      const trimmed = prev.trim()
      if (trimmed.length > 0) return prev
      return tenantName
    })
  }, [tenantName])

  useEffect(() => {
    if (statusData?.qr) setLocalQr(statusData.qr)
    if (statusData?.qrExpiresAt) setLocalQrExpiresAt(statusData.qrExpiresAt)
  }, [statusData?.qr, statusData?.qrExpiresAt])

  useEffect(() => {
    if (connectInstanceMutation.data?.qr)
      setLocalQr(connectInstanceMutation.data.qr)
    if (connectInstanceMutation.data?.qrExpiresAt)
      setLocalQrExpiresAt(connectInstanceMutation.data.qrExpiresAt)
  }, [connectInstanceMutation.data])

  useEffect(() => {
    if (status !== 'qr_pending') {
      setLocalQr(null)
      setLocalQrExpiresAt(null)
    }
  }, [status])

  const effectiveQr = statusData?.qr ?? localQr
  const effectiveQrExpiresAt = statusData?.qrExpiresAt ?? localQrExpiresAt

  useEffect(() => {
    if (!effectiveQrExpiresAt) {
      setCountdownSeconds(0)
      return
    }

    const updateCountdown = () => {
      const ms = new Date(effectiveQrExpiresAt).getTime() - Date.now()
      setCountdownSeconds(Math.max(Math.floor(ms / 1000), 0))
    }

    updateCountdown()
    const timerId = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(timerId)
  }, [effectiveQrExpiresAt])

  useEffect(() => {
    if (!auth?.tenantId) return

    const channel = supabase
      .channel(`whatsapp-status-${auth.tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_sessions_public',
          filter: `tenant_id=eq.${auth.tenantId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          queryClient.setQueryData<InstanceStatusDTO | undefined>(
            instanceStatusQueryKey,
            (old) => ({
              status:
                (payload.new.status as ConnectionStatus | undefined) ??
                old?.status ??
                'disconnected',
              instanceName:
                (payload.new.instance_name as string | null | undefined) ??
                old?.instanceName ??
                null,
              phoneNumber:
                (payload.new.phone_number as string | null | undefined) ??
                old?.phoneNumber ??
                null,
              lastHeartbeatAt:
                (payload.new.last_heartbeat_at as string | null | undefined) ??
                old?.lastHeartbeatAt ??
                null,
              lastError:
                (payload.new.last_error as string | null | undefined) ??
                old?.lastError ??
                null,
              qrExpiresAt:
                (payload.new.qr_expires_at as string | null | undefined) ??
                old?.qrExpiresAt ??
                null,
              qr: old?.qr ?? null,
            }),
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [auth?.tenantId, queryClient])

  const uiState = useMemo(
    () =>
      getUiState(
        status,
        statusData?.instanceName ?? null,
        effectiveQrExpiresAt ?? null,
      ),
    [effectiveQrExpiresAt, status, statusData?.instanceName],
  )

  const isBusy =
    createInstanceMutation.isPending ||
    connectInstanceMutation.isPending ||
    deleteInstanceMutation.isPending

  const validationError = (() => {
    const length = instanceNameInput.trim().length
    if (length === 0) return 'Informe o nome da instância.'
    if (length > 64) return 'O nome deve ter no máximo 64 caracteres.'
    return null
  })()

  const handleCreateInstance = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isOwner || validationError) return
    createInstanceMutation.mutate(
      { name: instanceNameInput.trim() },
      {
        onSuccess: () => {
          setLocalQr(null)
          setLocalQrExpiresAt(null)
          queryClient.invalidateQueries({ queryKey: instanceStatusQueryKey })
        },
      },
    )
  }

  const handleConnect = () => {
    if (!isOwner) return
    connectInstanceMutation.mutate()
  }

  const handleDelete = () => {
    if (!isOwner) return
    deleteInstanceMutation.mutate(undefined, {
      onSuccess: () => {
        setLocalQr(null)
        setLocalQrExpiresAt(null)
        deleteDialogRef.current?.close()
      },
    })
  }

  const mutationError =
    createInstanceMutation.error?.message ??
    connectInstanceMutation.error?.message ??
    deleteInstanceMutation.error?.message ??
    null

  if (authLoading || statusLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  return (
    <div className="relative mx-auto max-w-3xl px-4 py-10 anim-fade-up">
      <div className="surface-elevated relative overflow-hidden rounded-3xl p-8 sm:p-10">
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/12 blur-3xl"
        />
        <div className="relative mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success/15 text-success">
            <Wifi className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Conexão com o WhatsApp
            </h1>
            <p className="text-sm text-base-content/60">
              Crie, conecte e acompanhe a instância do WhatsApp da sua empresa.
            </p>
          </div>
        </div>

        {import.meta.env.VITE_UAZAPI_ENV === 'free' && (
          <div className="alert alert-info mb-6">
            <span>Servidor de teste — instância expira em ~1h</span>
          </div>
        )}

        {!isOwner && (
          <div className="alert alert-warning mb-6">
            <span>Apenas o proprietário pode gerenciar a conexão.</span>
          </div>
        )}

        {mutationError && (
          <div className="alert alert-error mb-6">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{mutationError}</span>
          </div>
        )}

        {uiState === 'no_instance' && (
          <form
            className="space-y-4 rounded-2xl border border-base-200 bg-base-200/50 p-5"
            onSubmit={handleCreateInstance}
          >
            <h2 className="font-semibold">Criar instância</h2>
            <label className="form-control gap-2">
              <span className="label-text">Nome da instância</span>
              <input
                type="text"
                className="input input-bordered w-full"
                value={instanceNameInput}
                maxLength={64}
                onChange={(event) => setInstanceNameInput(event.target.value)}
                disabled={!isOwner || isBusy}
              />
            </label>
            {validationError && (
              <p className="text-sm text-error">{validationError}</p>
            )}
            {isOwner && (
              <button
                type="submit"
                className="btn btn-primary rounded-full px-5"
                disabled={Boolean(validationError) || isBusy}
              >
                {createInstanceMutation.isPending
                  ? 'Criando…'
                  : 'Criar instância'}
              </button>
            )}
          </form>
        )}

        {connectInstanceMutation.isPending && (
          <div className="flex flex-col items-center gap-4 py-10">
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="text-sm text-base-content/70">A gerar QR code…</p>
          </div>
        )}

        {uiState === 'disconnected' && !connectInstanceMutation.isPending && (
          <div className="space-y-4 rounded-2xl border border-base-200 bg-base-200/50 p-5">
            <div className="flex items-center gap-2.5">
              <Smartphone className="h-5 w-5 text-base-content/55" />
              <span className="font-semibold">Instância desconectada</span>
            </div>
            <p className="text-sm text-base-content/70">
              Instância:{' '}
              <span className="font-semibold">{statusData?.instanceName}</span>
            </p>
            {isOwner && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary rounded-full px-5"
                  onClick={handleConnect}
                  disabled={isBusy}
                >
                  {connectInstanceMutation.isPending
                    ? 'Conectando…'
                    : 'Conectar agora'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-error rounded-full px-5"
                  onClick={() => deleteDialogRef.current?.showModal()}
                  disabled={isBusy}
                >
                  Excluir instância
                </button>
              </div>
            )}
          </div>
        )}

        {uiState === 'qr_pending_valid' && (
          <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
            <div className="relative rounded-2xl bg-base-100 p-4 shadow-md ring-1 ring-base-200">
              {effectiveQr ? (
                <img
                  src={effectiveQr}
                  alt="QR Code do WhatsApp"
                  className="block h-56 w-56 rounded-lg"
                />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center rounded-lg bg-base-200">
                  <span className="loading loading-spinner loading-md text-primary" />
                </div>
              )}
              <span className="chip chip-primary absolute -right-2 -top-2">
                <span className="anim-pulse-soft h-1.5 w-1.5 rounded-full bg-primary" />
                Aguardando
              </span>
            </div>
            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-warning">
                <QrCode className="h-4 w-4" />
                Expira em {formatRemaining(countdownSeconds)}
              </p>
              <ol className="list-inside list-decimal space-y-2 text-sm text-base-content/75">
                <li>Abra o WhatsApp no seu celular.</li>
                <li>Vá em Configurações → Aparelhos conectados.</li>
                <li>Toque em Conectar aparelho e escaneie o QR code.</li>
                <li>Após a leitura, aguarde a confirmação no CRM.</li>
              </ol>
            </div>
          </div>
        )}

        {uiState === 'qr_pending_expired' && !connectInstanceMutation.isPending && (
          <div className="space-y-4 rounded-2xl border border-warning/40 bg-warning/10 p-5">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 text-warning" />
              <span className="font-semibold">QR expirado</span>
            </div>
            <p className="text-sm text-base-content/70">
              O QR code expirou. Gere um novo QR para continuar a conexão.
            </p>
            {isOwner && (
              <button
                type="button"
                className="btn btn-primary rounded-full px-5 gap-2"
                onClick={handleConnect}
                disabled={isBusy}
              >
                <RefreshCcw className="h-4 w-4" />
                {connectInstanceMutation.isPending
                  ? 'Gerando…'
                  : 'Gerar novo QR'}
              </button>
            )}
          </div>
        )}

        {uiState === 'connecting' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="text-base-content/70">Sincronizando com WhatsApp…</p>
          </div>
        )}

        {uiState === 'connected' && (
          <div className="space-y-4 rounded-2xl border border-success/30 bg-success/8 p-5">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="font-semibold text-success">
                WhatsApp conectado
              </span>
            </div>
            <p className="text-sm text-base-content/70">
              Instância:{' '}
              <span className="font-semibold">
                {statusData?.instanceName ?? '—'}
              </span>
            </p>
            <p className="text-sm text-base-content/70">
              Número ativo:{' '}
              <span className="font-mono">
                {formatPhonePtBr(statusData?.phoneNumber) ?? '—'}
              </span>
            </p>
            {isOwner && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline rounded-full px-5"
                  disabled
                >
                  <Link2Off className="h-4 w-4" />
                  Desconectar
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-error rounded-full px-5"
                  onClick={() => deleteDialogRef.current?.showModal()}
                  disabled={isBusy}
                >
                  Excluir instância
                </button>
              </div>
            )}
          </div>
        )}

        {uiState === 'error' && (
          <div className="space-y-4 rounded-2xl border border-error/40 bg-error/10 p-5">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 text-error" />
              <span className="font-semibold text-error">Erro na conexão</span>
            </div>
            <p className="text-sm text-base-content/70">
              {statusData?.lastError ??
                'Não foi possível concluir a conexão com o WhatsApp.'}
            </p>
            {isOwner && (
              <button
                type="button"
                className="btn btn-primary rounded-full px-5"
                onClick={handleConnect}
                disabled={isBusy}
              >
                {connectInstanceMutation.isPending
                  ? 'Tentando…'
                  : 'Tentar novamente'}
              </button>
            )}
          </div>
        )}
      </div>

      <dialog ref={deleteDialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Excluir instância</h3>
          <p className="py-3 text-sm text-base-content/70">
            Esta ação remove a conexão com o WhatsApp e não pode ser desfeita.
          </p>
          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={() => deleteDialogRef.current?.close()}
              disabled={isBusy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-error gap-2"
              onClick={handleDelete}
              disabled={isBusy}
            >
              <Trash2 className="h-4 w-4" />
              {deleteInstanceMutation.isPending
                ? 'Excluindo…'
                : 'Confirmar exclusão'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
