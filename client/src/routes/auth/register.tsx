import { createFileRoute } from '@tanstack/react-router'
import { RegisterScreen } from '../../features/auth/RegisterScreen'

export const Route = createFileRoute('/auth/register')({
  component: RegisterScreen,
})
