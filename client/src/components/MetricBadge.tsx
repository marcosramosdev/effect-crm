type MetricBadgeProps = {
  count: number
  dot?: boolean
  className?: string
}

export function MetricBadge({
  count,
  dot = true,
  className,
}: MetricBadgeProps) {
  if (count === 0) return null
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${className ?? ''}`}
    >
      {dot && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      )}
      {count}
    </span>
  )
}
