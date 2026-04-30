import type { ReactNode } from 'react'
import { FilterPills } from '../../components/FilterPills'
import type { FilterPill } from '../../components/FilterPills'
import { ViewTabs } from '../../components/ViewTabs'
import type { ViewTab } from '../../components/ViewTabs'
import { UserMenu } from './UserMenu'

type AppBarProps = {
  title: string
  filters?: FilterPill[]
  onFilterSelect?: (label: string) => void
  viewTabs?: ViewTab[]
  onViewTabChange?: (label: string) => void
  actions?: ReactNode
}

export function AppBar({
  title,
  filters,
  onFilterSelect,
  viewTabs,
  onViewTabChange,
  actions,
}: AppBarProps) {
  return (
    <header className="flex items-center gap-4 h-14 px-4 bg-base-100 border-b border-base-200 shrink-0">
      <h1 className="font-semibold text-base whitespace-nowrap">{title}</h1>

      {/* View tab strip in centre */}
      {viewTabs && viewTabs.length > 0 && (
        <div className="flex-1 flex justify-center">
          <ViewTabs tabs={viewTabs} onChange={onViewTabChange} />
        </div>
      )}

      {/* Fallback: filter pills if no viewTabs */}
      {!viewTabs && filters && filters.length > 0 && (
        <div className="flex-1 flex justify-center">
          <FilterPills pills={filters} onSelect={onFilterSelect} />
        </div>
      )}

      {/* Spacer when no centre content */}
      {!viewTabs && (!filters || filters.length === 0) && (
        <div className="flex-1" />
      )}

      {/* Action cluster + UserMenu */}
      <div className="flex items-center gap-2 ml-auto">
        {actions}
        <UserMenu />
      </div>
    </header>
  )
}
