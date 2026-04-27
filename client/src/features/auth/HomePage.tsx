import { Link } from '@tanstack/react-router'

export function HomePage() {
  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content text-center">
        <div className="max-w-md">
          <h1 className="text-5xl font-bold">CRM Effect</h1>
          <p className="py-6">
            Gestão de clientes e leads para equipas de marketing digital.
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/auth/login" className="btn btn-primary">
              Entrar
            </Link>
            <Link to="/auth/register" className="btn btn-outline">
              Criar conta
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
