import { useEffect, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PipelineCard } from '../PipelineCard'
import type { PipelineLead, PipelineStage } from '@shared/pipeline'

interface SortableLeadCardProps {
  lead: PipelineLead
  stage?: PipelineStage
  onOpenEdit: (lead: PipelineLead) => void
}

export function SortableLeadCard({
  lead,
  stage,
  onOpenEdit,
}: SortableLeadCardProps) {
  const prefersReducedMotion = usePrefersReducedMotion()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: prefersReducedMotion ? undefined : transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <PipelineCard
        lead={lead}
        stage={stage}
        onClick={() => onOpenEdit(lead)}
      />
    </div>
  )
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return prefersReducedMotion
}
