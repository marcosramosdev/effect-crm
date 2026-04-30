import type { ReactNode } from 'react'
import type { FilterPill } from '../../components/FilterPills'
import { AppBar } from './AppBar'
import { Sidebar } from './Sidebar'

type DashboardLayoutProps = {
  title: string
  filters?: FilterPill[]
  onFilterSelect?: (label: string) => void
  actions?: ReactNode
  contentClassName?: string
  children: ReactNode
}

export function DashboardLayout({
  title,
  filters,
  onFilterSelect,
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
          filters={filters}
          onFilterSelect={onFilterSelect}
          actions={actions}
        />
        <main className={contentClassName}>{children}</main>
      </div>
    </div>
  )
}
