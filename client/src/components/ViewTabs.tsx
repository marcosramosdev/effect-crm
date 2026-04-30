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
    <div className="flex items-center gap-1" role="tablist" aria-label="Views">
      {tabs.map((tab) => (
        <button
          key={tab.label}
          role="tab"
          aria-selected={tab.active}
          aria-disabled={tab.disabled}
          tabIndex={tab.disabled ? -1 : 0}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            tab.active
              ? 'bg-base-200 text-base-content font-medium'
              : tab.disabled
                ? 'text-base-content/30 cursor-not-allowed'
                : 'text-base-content/60 hover:bg-base-200/60 hover:text-base-content'
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
