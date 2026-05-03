import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

type PromoCardProps = {
  title: string
  body: string
  ctaLabel: string
  onCta?: () => void
  illustration?: ReactNode
  className?: string
}

export function PromoCard({
  title,
  body,
  ctaLabel,
  onCta,
  illustration,
  className,
}: PromoCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-base-200 bg-mesh bg-grain p-5 flex flex-col gap-3 min-h-[10rem] ${className ?? ''}`}
    >
      <div className="relative flex-1">
        <span className="inline-flex items-center gap-1.5 chip chip-primary mb-3">
          <Sparkles className="h-3 w-3" />
          Premium
        </span>
        <p className="font-display text-lg leading-tight text-balance text-base-content">
          {title}
        </p>
        <p className="text-sm text-base-content/70 mt-1.5 text-pretty">{body}</p>
      </div>
      <button
        type="button"
        onClick={onCta}
        className="btn btn-neutral btn-sm w-fit rounded-full px-4 self-start"
      >
        {ctaLabel}
      </button>
      {illustration && (
        <div className="flex justify-end mt-1 relative">{illustration}</div>
      )}
    </div>
  )
}
