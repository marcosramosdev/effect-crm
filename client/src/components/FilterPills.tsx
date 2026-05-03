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
    <div className="flex items-center gap-1.5 flex-wrap">
      {pills.map((pill) => (
        <button
          key={pill.label}
          type="button"
          aria-pressed={pill.active ? 'true' : 'false'}
          onClick={() => onSelect?.(pill.label)}
          className={`group inline-flex items-center gap-2 h-8 pl-3 pr-2 rounded-full text-sm transition-all duration-150 border ${
            pill.active
              ? 'bg-base-content text-base-100 border-base-content shadow-sm'
              : 'bg-base-100 text-base-content/70 border-base-200 hover:border-base-content/30 hover:text-base-content'
          }`}
        >
          <span className="font-medium">{pill.label}</span>
          <span
            className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] tabular-nums font-semibold ${
              pill.active
                ? 'bg-base-100/15 text-base-100'
                : 'bg-base-200 text-base-content/70 group-hover:bg-base-content/10'
            }`}
          >
            {pill.count}
          </span>
        </button>
      ))}
    </div>
  )
}
