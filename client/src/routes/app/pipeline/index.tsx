import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/pipeline/')({
  beforeLoad: () => {
    throw redirect({ to: '/app/contacts' })
  },
})
