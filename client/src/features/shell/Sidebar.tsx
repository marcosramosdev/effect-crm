import { Link, useRouterState } from '@tanstack/react-router'
import type { ComponentType } from 'react'
import {
  BoardIcon,
  CogIcon,
  HomeIcon,
  InboxIcon,
  PlugIcon,
  SunIcon,
} from '../../components/icons'
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
  { to: '/app/pipeline', icon: BoardIcon, label: 'Pipeline' },
  { to: '/app/connect', icon: PlugIcon, label: 'Conectar', ownerOnly: true },
  {
    to: '/app/settings/pipeline',
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
    <aside className="flex flex-col h-full w-16 shrink-0 bg-base-100 border-r border-base-200">
      <div className="flex items-center justify-center h-14 border-b border-base-200 shrink-0">
        <span className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-content font-bold text-sm select-none">
          C
        </span>
      </div>

      <nav className="flex flex-col gap-1 flex-1 py-3 px-2">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
              className={`flex items-center justify-center h-10 w-10 rounded-lg mx-auto transition-colors ${
                isActive
                  ? 'bg-base-200 text-base-content'
                  : 'text-base-content/50 hover:bg-base-200/60 hover:text-base-content'
              }`}
            >
              <item.icon className="h-5 w-5 stroke-current fill-none" />
              <span className="sr-only">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="flex items-center justify-center h-14 border-t border-base-200 shrink-0">
        <button
          onClick={() => {}}
          title="Tema"
          className="flex items-center justify-center h-10 w-10 rounded-lg text-base-content/50 hover:bg-base-200/60 hover:text-base-content transition-colors"
        >
          <SunIcon className="h-5 w-5 stroke-current fill-none" />
          <span className="sr-only">Tema</span>
        </button>
      </div>
    </aside>
  )
}
