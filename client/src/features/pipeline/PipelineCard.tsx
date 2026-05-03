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
      className="group rounded-xl bg-base-100 border border-base-200 hover:border-base-content/15 hover:shadow-[0_8px_22px_-14px_rgba(0,0,0,0.18)] transition-all duration-150 cursor-pointer p-3 flex flex-col gap-2.5"
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
      <div className="flex items-center justify-between gap-2">
        {stage && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
            style={{
              backgroundColor: stage.color + '15',
              borderColor: stage.color + '40',
              color: stage.color,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            {stage.name}
          </span>
        )}
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 ring-1 ring-base-200 flex items-center justify-center text-[10px] font-semibold text-base-content/75">
          {getInitials(displayName)}
        </div>
      </div>

      <p
        className="font-display font-semibold tracking-tight text-[14px] truncate text-base-content"
        title={displayName}
      >
        {displayName}
      </p>

      <div className="flex items-center gap-3 text-[11px] text-base-content/55">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {dateStr}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeInStage}
        </span>
      </div>

      <div className="flex items-center justify-between pt-1.5 border-t border-base-200/70">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-base-content/45">
          Novo
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-base-content/55">
          <MessageSquare className="h-3 w-3" />0
        </span>
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
