import { ChevronDown, LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useLogoutMutation } from '../auth/useLogoutMutation'

export function UserMenu() {
  const { data: user } = useAuth()
  const logoutMutation = useLogoutMutation()

  const initial = (user?.email ?? 'U')[0].toUpperCase()
  const roleLabel = user?.role === 'owner' ? 'Proprietário' : 'Agente'

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="flex items-center gap-2 h-9 pl-1 pr-2.5 rounded-full border border-base-200 bg-base-100 hover:border-base-content/20 hover:bg-base-200/50 transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 text-primary-content flex items-center justify-center text-xs font-semibold">
          {initial}
        </span>
        <span className="hidden sm:inline text-[13px] font-medium text-base-content/85 max-w-[10rem] truncate">
          {user?.email}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-base-content/50" />
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content menu menu-sm bg-base-100 border border-base-200 rounded-2xl z-30 mt-3 w-64 p-2 shadow-[0_12px_36px_-18px_rgba(0,0,0,0.25)]"
      >
        <li className="menu-title px-3 py-2 pointer-events-none">
          <div className="font-display font-semibold text-sm truncate text-base-content">
            {user?.tenantName}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="chip chip-primary">{roleLabel}</span>
            <span className="text-[11px] text-base-content/50 truncate">
              {user?.email}
            </span>
          </div>
        </li>
        <li>
          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="text-error gap-2"
          >
            <LogOut className="h-4 w-4" />
            {logoutMutation.isPending ? 'Saindo…' : 'Sair'}
          </button>
        </li>
      </ul>
    </div>
  )
}
