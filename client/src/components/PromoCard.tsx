import type { ReactNode } from 'react'

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
      className={`rounded-2xl bg-warning/20 border border-warning/30 p-5 flex flex-col gap-3 ${className ?? ''}`}
    >
      <div className="flex-1">
        <p className="font-semibold text-base-content leading-snug">{title}</p>
        <p className="text-sm text-base-content/70 mt-1">{body}</p>
      </div>
      <button
        onClick={onCta}
        className="btn btn-neutral btn-sm w-fit rounded-full"
      >
        {ctaLabel}
      </button>
      {illustration && (
        <div className="flex justify-end mt-1">{illustration}</div>
      )}
    </div>
  )
}
