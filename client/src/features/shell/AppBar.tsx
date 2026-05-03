import type { ReactNode } from 'react'
import { FilterPills } from '../../components/FilterPills'
import type { FilterPill } from '../../components/FilterPills'
import { ViewTabs } from '../../components/ViewTabs'
import type { ViewTab } from '../../components/ViewTabs'
import { UserMenu } from './UserMenu'

type AppBarProps = {
  title: string
  subtitle?: string
  filters?: FilterPill[]
  onFilterSelect?: (label: string) => void
  viewTabs?: ViewTab[]
  onViewTabChange?: (label: string) => void
  actions?: ReactNode
}

export function AppBar({
  title,
  subtitle,
  filters,
  onFilterSelect,
  viewTabs,
  onViewTabChange,
  actions,
}: AppBarProps) {
  return (
    <header className="flex items-center gap-4 min-h-[3.75rem] px-5 bg-base-100/85 backdrop-blur-sm border-b border-base-200 shrink-0 sticky top-0 z-20">
      <div className="flex flex-col justify-center min-w-0">
        <h1 className="font-display font-semibold text-[17px] tracking-tight whitespace-nowrap leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-base-content/55 truncate mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {/* View tab strip */}
      {viewTabs && viewTabs.length > 0 && (
        <div className="flex-1 flex justify-center">
          <ViewTabs tabs={viewTabs} onChange={onViewTabChange} />
        </div>
      )}

      {/* Fallback: filter pills */}
      {!viewTabs && filters && filters.length > 0 && (
        <div className="flex-1 flex justify-center overflow-x-auto">
          <FilterPills pills={filters} onSelect={onFilterSelect} />
        </div>
      )}

      {!viewTabs && (!filters || filters.length === 0) && (
        <div className="flex-1" />
      )}

      <div className="flex items-center gap-2 ml-auto shrink-0">
        {actions}
        <UserMenu />
      </div>
    </header>
  )
}
