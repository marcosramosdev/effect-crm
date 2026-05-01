import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/pipeline/settings')({
  beforeLoad: () => {
    throw redirect({ to: '/app/contacts', search: { view: 'board' } })
  },
})
