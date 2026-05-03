export interface ViewTab {
  label: string
  active?: boolean
  disabled?: boolean
}

interface ViewTabsProps {
  tabs: ViewTab[]
  onChange?: (label: string) => void
}

export function ViewTabs({ tabs, onChange }: ViewTabsProps) {
  return (
    <div
      className="inline-flex items-center gap-0.5 p-1 rounded-full bg-base-200/70 border border-base-200"
      role="tablist"
      aria-label="Visualizações"
    >
      {tabs.map((tab) => (
        <button
          key={tab.label}
          type="button"
          role="tab"
          aria-selected={tab.active}
          aria-disabled={tab.disabled}
          tabIndex={tab.disabled ? -1 : 0}
          className={`px-3.5 py-1.5 text-sm rounded-full transition-all duration-200 ${
            tab.active
              ? 'bg-base-100 text-base-content font-medium shadow-sm ring-1 ring-base-content/5'
              : tab.disabled
                ? 'text-base-content/30 cursor-not-allowed'
                : 'text-base-content/60 hover:text-base-content'
          }`}
          onClick={() => {
            if (!tab.disabled) onChange?.(tab.label)
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
