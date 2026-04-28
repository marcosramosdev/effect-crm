import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { authQueryOptions } from '../hooks/useAuth'
import { UserMenu } from '../features/shell/UserMenu'

export const Route = createFileRoute('/app')({
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(authQueryOptions)
    } catch {
      throw redirect({
        to: '/auth/login',
        search: { redirect: location.href },
      })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="navbar bg-base-100 border-b border-base-200 px-4">
        <div className="flex-1">
          <span className="font-semibold text-sm">CRM</span>
        </div>
        <div className="flex-none">
          <UserMenu />
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
