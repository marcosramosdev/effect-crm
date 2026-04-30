import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/settings/pipeline')({
  beforeLoad: () => {
    throw redirect({ to: '/app/settings/profile' })
  },
})
