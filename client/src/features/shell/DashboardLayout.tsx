import type { ReactNode } from 'react'
import type { FilterPill } from '../../components/FilterPills'
import type { ViewTab } from '../../components/ViewTabs'
import { AppBar } from './AppBar'
import { Sidebar } from './Sidebar'

type DashboardLayoutProps = {
  title: string
  subtitle?: string
  filters?: FilterPill[]
  onFilterSelect?: (label: string) => void
  viewTabs?: ViewTab[]
  onViewTabChange?: (label: string) => void
  actions?: ReactNode
  contentClassName?: string
  children: ReactNode
}

export function DashboardLayout({
  title,
  subtitle,
  filters,
  onFilterSelect,
  viewTabs,
  onViewTabChange,
  actions,
  contentClassName = 'bg-base-200 flex-1 overflow-auto p-6',
  children,
}: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <AppBar
          title={title}
          subtitle={subtitle}
          filters={filters}
          onFilterSelect={onFilterSelect}
          viewTabs={viewTabs}
          onViewTabChange={onViewTabChange}
          actions={actions}
        />
        <main className={contentClassName}>{children}</main>
      </div>
    </div>
  )
}
