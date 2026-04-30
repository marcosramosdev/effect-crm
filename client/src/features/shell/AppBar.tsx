import type { ReactNode } from 'react'
import { FilterPills } from '../../components/FilterPills'
import type { FilterPill } from '../../components/FilterPills'
import { UserMenu } from './UserMenu'

type AppBarProps = {
  title: string
  filters?: FilterPill[]
  onFilterSelect?: (label: string) => void
  actions?: ReactNode
}

export function AppBar({
  title,
  filters,
  onFilterSelect,
  actions,
}: AppBarProps) {
  return (
    <header className="flex items-center gap-4 h-14 px-4 bg-base-100 border-b border-base-200 shrink-0">
      <h1 className="font-semibold text-base whitespace-nowrap">{title}</h1>

      {filters && filters.length > 0 && (
        <div className="flex-1 flex justify-center">
          <FilterPills pills={filters} onSelect={onFilterSelect} />
        </div>
      )}

      <div className="flex items-center gap-2 ml-auto">
        {actions}
        <UserMenu />
      </div>
    </header>
  )
}
