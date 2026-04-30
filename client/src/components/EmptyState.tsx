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
        <div className="text-base-content/30 [&_svg]:h-10 [&_svg]:w-10">
          {icon}
        </div>
      )}
      <p className="font-semibold text-base-content">{heading}</p>
      {body && <p className="text-sm text-base-content/60 max-w-xs">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
