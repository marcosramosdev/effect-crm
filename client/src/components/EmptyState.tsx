import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon?: ReactNode
  heading: string
  body?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  heading,
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-16 text-center ${className ?? ''}`}
    >
      {icon && (
        <div className="flex items-center justify-center h-14 w-14 rounded-full bg-base-200/70 text-base-content/40 [&_svg]:h-7 [&_svg]:w-7">
          {icon}
        </div>
      )}
      <p className="font-display text-base font-semibold text-base-content text-balance">
        {heading}
      </p>
      {body && (
        <p className="text-sm text-base-content/60 max-w-sm text-pretty">
          {body}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
