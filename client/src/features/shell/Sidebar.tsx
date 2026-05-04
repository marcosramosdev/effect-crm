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
  { to: '/app/dashboard', icon: HomeIcon, label: 'Painel' },
  { to: '/app/inbox', icon: InboxIcon, label: 'Caixa de entrada' },
  { to: '/app/contacts', icon: BoardIcon, label: 'Pipeline' },
  { to: '/app/connect', icon: PlugIcon, label: 'Conectar', ownerOnly: true },
  {
    to: '/app/settings/profile',
    icon: CogIcon,
    label: 'Configurações',
    ownerOnly: true,
  },
]

export function Sidebar() {
  const { data: auth } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const items = NAV_ITEMS.filter(
    (item) => !item.ownerOnly || auth?.role === 'owner',
  )

  const initial = (auth?.email ?? 'U')[0].toUpperCase()

  return (
    <aside className="flex flex-col h-full w-60 shrink-0 bg-base-100 border-r border-base-200 relative">
      {/* Brand block */}
      <div className="flex items-center gap-2.5 h-16 px-5 border-b border-base-200 shrink-0">
        <span
          aria-hidden="true"
          className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-content font-display font-bold text-base select-none shadow-[inset_0_-2px_0_rgba(0,0,0,0.15),0_4px_12px_-4px_color-mix(in_oklch,var(--color-primary)_45%,transparent)]"
        >
          <span className="absolute inset-0 rounded-xl bg-grain opacity-40" />
          <span className="relative">C</span>
        </span>
        <div className="flex flex-col leading-tight">
          <span className="font-display font-semibold text-[15px] tracking-tight">
            CRM Effect
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/45 font-medium">
            Pipeline · Inbox
          </span>
        </div>
      </div>

      {/* Nav list */}
      <nav
        className="flex flex-col gap-1 flex-1 py-4 px-3"
        aria-label="Principal"
      >
        <p className="px-3 pb-1.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-base-content/40">
          Trabalho
        </p>
        {items.map((item) => {
          const isActive =
            item.to === '/app/dashboard'
              ? pathname.startsWith('/app/dashboard')
              : pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isActive ? 'page' : undefined}
              className="nav-link group relative"
            >
              <item.icon className="h-[18px] w-[18px] stroke-current fill-none shrink-0 transition-transform group-hover:scale-105" />
              <span className="text-[13.5px]">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Support block */}
      <div className="px-3 pb-3 shrink-0">
        <div className="relative overflow-hidden rounded-2xl bg-mesh bg-grain border border-base-200 p-4">
          <div className="relative">
            <p className="text-[11px] font-semibold text-base-content/70 uppercase tracking-wider mb-1">
              Precisa de ajuda?
            </p>
            <p className="text-xs text-base-content/60 mb-3 leading-snug">
              Nossa equipe responde em minutos.
            </p>
            <button
              type="button"
              className="btn btn-sm btn-neutral w-full rounded-full gap-1.5"
              onClick={() => {}}
            >
              <LifeBuoy className="h-3.5 w-3.5" />
              Falar conosco
            </button>
          </div>
        </div>
      </div>

      {/* User profile block */}
      <div className="flex items-center gap-3 h-16 px-4 border-t border-base-200 shrink-0">
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-base-200 border border-base-300 flex items-center justify-center text-sm font-semibold text-base-content">
            {initial}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-base-100" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold truncate leading-tight">
            {auth?.email ?? 'Usuário'}
          </p>
          <p className="text-[11px] text-base-content/50 truncate mt-0.5">
            {auth?.tenantName ?? 'Empresa'}
          </p>
        </div>
      </div>
    </aside>
  )
}
