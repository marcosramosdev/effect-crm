import { useEffect, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { Card } from '../../../components/Card'
import type { PipelineLead, CustomFieldDef } from '@shared/pipeline'

interface SortableLeadCardProps {
  lead: PipelineLead
  customFields: CustomFieldDef[]
  onOpenEdit: (lead: PipelineLead) => void
}

export function SortableLeadCard({
  lead,
  customFields,
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
    >
      <Card
        as="div"
        className="p-3 hover:shadow-md transition-shadow"
        onClick={() => onOpenEdit(lead)}
      >
        <div className="flex items-start gap-2">
          <GripVertical
            className="h-4 w-4 text-base-content/40 shrink-0 mt-0.5"
            {...attributes}
            {...listeners}
          />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">
              {lead.displayName ?? formatPhone(lead.phoneNumber)}
            </div>
            <div className="text-xs text-base-content/60 truncate">
              {formatPhone(lead.phoneNumber)}
            </div>
            {lead.customValues &&
              Object.keys(lead.customValues).length > 0 &&
              customFields.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(lead.customValues)
                    .filter(([, v]) => v !== null)
                    .slice(0, 3)
                    .map(([fieldId, value]) => {
                      const field = customFields.find((f) => f.id === fieldId)
                      if (!field) return null
                      return (
                        <span
                          key={fieldId}
                          className="badge badge-xs badge-ghost"
                          title={`${field.label}: ${value}`}
                        >
                          {field.label}: {value}
                        </span>
                      )
                    })}
                </div>
              )}
          </div>
        </div>
      </Card>
    </div>
  )
}

function formatPhone(phone: string): string {
  if (phone.startsWith('manual:')) return '\u2014'
  return phone
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
