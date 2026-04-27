import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { authQueryOptions } from '../hooks/useAuth'

export const Route = createFileRoute('/auth')({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(authQueryOptions)
      throw redirect({ to: '/app' })
    } catch (err) {
      if (err != null && typeof err === 'object' && 'to' in err) throw err
      // auth failure → fall through to children
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <Outlet />
    </div>
  )
}
