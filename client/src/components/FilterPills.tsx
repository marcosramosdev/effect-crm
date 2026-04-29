export type FilterPill = {
  label: string
  count: number
  active?: boolean
}

type FilterPillsProps = {
  pills: FilterPill[]
  onSelect?: (label: string) => void
}

export function FilterPills({ pills, onSelect }: FilterPillsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {pills.map((pill) => (
        <button
          key={pill.label}
          aria-pressed={pill.active ? 'true' : 'false'}
          onClick={() => onSelect?.(pill.label)}
          className={`btn btn-sm gap-1.5 rounded-full ${
            pill.active ? 'btn-neutral' : 'btn-ghost border border-base-300'
          }`}
        >
          {pill.label}
          <span className="badge badge-sm">{pill.count}</span>
        </button>
      ))}
    </div>
  )
}
