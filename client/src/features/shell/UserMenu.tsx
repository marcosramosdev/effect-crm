import { useAuth } from '../../hooks/useAuth'
import { useLogoutMutation } from '../auth/useLogoutMutation'

export function UserMenu() {
  const { data: user } = useAuth()
  const logoutMutation = useLogoutMutation()

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-sm gap-1">
        <span className="hidden sm:inline text-sm">{user?.email}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="h-4 w-4 stroke-current"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content menu menu-sm bg-base-100 shadow rounded-box z-[1] mt-3 w-52 p-2"
      >
        <li className="menu-title px-4 py-2">
          <div className="font-medium text-sm truncate">{user?.tenantName}</div>
          <div className="badge badge-outline badge-xs mt-1">{user?.role}</div>
        </li>
        <li>
          <button
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="text-error"
          >
            {logoutMutation.isPending ? 'A sair…' : 'Sair'}
          </button>
        </li>
      </ul>
    </div>
  )
}
