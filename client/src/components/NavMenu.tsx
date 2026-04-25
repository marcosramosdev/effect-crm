import { Link } from '@tanstack/react-router'
import { useAuth } from '../hooks/useAuth'

export function NavMenu() {
  const { data: auth } = useAuth()

  return (
    <nav className="flex gap-4">
      <Link to="/inbox">Inbox</Link>
      <Link to="/pipeline">Pipeline</Link>
      {auth?.role === 'owner' && (
        <Link to="/settings/pipeline">Configurar Pipeline</Link>
      )}
    </nav>
  )
}
