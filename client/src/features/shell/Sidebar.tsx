import { Link, useRouterState } from '@tanstack/react-router'
import type { ComponentType } from 'react'
import {
  BoardIcon,
  CogIcon,
  HomeIcon,
  InboxIcon,
  PlugIcon,
} from '../../components/icons'
import { LifeBuoy } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

type NavItem = {
  to: string
  icon: ComponentType<{ className?: string }>
  label: string
  ownerOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/app/dashboard', icon: HomeIcon, label: 'Dashboard' },
  { to: '/app/inbox', icon: InboxIcon, label: 'Inbox' },
  { to: '/app/contacts', icon: BoardIcon, label: 'Contatos' },
  { to: '/app/connect', icon: PlugIcon, label: 'Conectar', ownerOnly: true },
  {
    to: '/app/settings/profile',
    icon: CogIcon,
    label: 'Configurar',
    ownerOnly: true,
  },
]

export function Sidebar() {
  const { data: auth } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const items = NAV_ITEMS.filter(
    (item) => !item.ownerOnly || auth?.role === 'owner',
  )

  return (
    <aside className="flex flex-col h-full w-56 shrink-0 bg-base-100 border-r border-base-200">
      {/* Brand block */}
      <div className="flex items-center gap-2 h-14 px-4 border-b border-base-200 shrink-0">
        <span className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-content font-bold text-sm select-none">
          C
        </span>
        <span className="font-semibold text-sm">CRM Effect</span>
        <span className="w-2 h-2 rounded-full bg-success" />
      </div>

      {/* Nav list */}
      <nav className="flex flex-col gap-1 flex-1 py-3 px-2">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 h-10 px-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-base-200 text-base-content'
                  : 'text-base-content/60 hover:bg-base-200/60 hover:text-base-content'
              }`}
            >
              <item.icon className="h-5 w-5 stroke-current fill-none shrink-0" />
              <span className="text-sm">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Support block */}
      <div className="px-3 py-3 border-t border-base-200 shrink-0">
        <div className="bg-base-200/50 rounded-lg p-3">
          <p className="text-xs text-base-content/70 mb-2 font-medium">
            Need support?
          </p>
          <button
            type="button"
            className="btn btn-sm btn-primary w-full"
            onClick={() => {}}
          >
            <LifeBuoy className="h-4 w-4" />
            Contact us
          </button>
        </div>
      </div>

      {/* User profile block */}
      <div className="flex items-center gap-3 h-14 px-4 border-t border-base-200 shrink-0">
        <div className="avatar placeholder">
          <div className="bg-neutral text-neutral-content w-8 rounded-full">
            <span className="text-xs">
              {(auth?.email ?? 'U')[0].toUpperCase()}
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {auth?.email ?? 'User'}
          </p>
          <p className="text-xs text-base-content/50 truncate">
            {auth?.tenantName ?? 'Tenant'}
          </p>
        </div>
      </div>
    </aside>
  )
}
