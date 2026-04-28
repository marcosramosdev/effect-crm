import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginScreen } from '../../features/auth/LoginScreen'

export const Route = createFileRoute('/auth/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect } = Route.useSearch()
  return <LoginScreen redirectTo={redirect} />
}
