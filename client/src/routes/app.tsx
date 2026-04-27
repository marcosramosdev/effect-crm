import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { authQueryOptions } from '../hooks/useAuth'

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
    <div className="min-h-screen">
      {/* UserMenu placeholder — mounted in US4 */}
      <Outlet />
    </div>
  )
}
