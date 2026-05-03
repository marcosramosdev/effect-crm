import { Calendar, Clock, MessageSquare } from 'lucide-react'
import type { PipelineLead, PipelineStage } from '@shared/pipeline'

interface PipelineCardProps {
  lead: PipelineLead
  stage?: PipelineStage
  onClick: () => void
}

export function PipelineCard({ lead, stage, onClick }: PipelineCardProps) {
  const displayName = lead.displayName ?? formatPhone(lead.phoneNumber)
  const dateStr = formatDate(lead.createdAt)
  const timeInStage = computeTimeInStage(lead.createdAt)

  return (
    <div
      className="card bg-base-100 border border-base-300 hover:bg-base-200/60 hover:shadow-sm transition-all duration-150 cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className="card-body p-3 gap-2">
        <div className="flex items-center justify-between">
          {stage && (
            <span
              className="badge badge-sm gap-1"
              style={{
                backgroundColor: stage.color + '18',
                borderColor: stage.color,
                color: stage.color,
              }}
            >
              {stage.name}
            </span>
          )}
          <div className="avatar placeholder">
            <div className="bg-neutral text-neutral-content w-6 rounded-full ring-1 ring-base-300">
              <span className="text-xs">{getInitials(displayName)}</span>
            </div>
          </div>
        </div>

        <div
          className="font-semibold tracking-tight text-sm truncate"
          title={displayName}
        >
          {displayName}
        </div>

        <div className="flex items-center gap-3 text-xs text-base-content/60">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {dateStr}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeInStage}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="badge badge-xs badge-outline">Novo</span>
          <span className="flex items-center gap-1 text-xs text-base-content/60">
            <MessageSquare className="h-3 w-3" />0
          </span>
        </div>
      </div>
    </div>
  )
}

function formatPhone(phone: string): string {
  if (phone.startsWith('manual:')) return '—'
  return phone
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function computeTimeInStage(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return '<1h'
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays === 1) return '1d'
  return `${diffDays}d`
}

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}
