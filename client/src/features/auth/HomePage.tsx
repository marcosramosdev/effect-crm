import { Link } from '@tanstack/react-router'
import { ArrowRight, MessageCircle, Layout, Users } from 'lucide-react'

export function HomePage() {
  return (
    <div className="min-h-screen bg-mesh bg-grain relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute -top-32 -right-32 w-[36rem] h-[36rem] rounded-full bg-primary/15 blur-3xl pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[-16rem] left-[-12rem] w-[32rem] h-[32rem] rounded-full bg-accent/15 blur-3xl pointer-events-none"
      />

      <header className="relative max-w-6xl mx-auto px-6 pt-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-content font-display font-bold shadow-lg">
            C
          </span>
          <span className="font-display font-semibold tracking-tight">
            CRM Effect
          </span>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            to="/auth/login"
            className="text-sm font-medium text-base-content/70 hover:text-base-content px-3 py-2 rounded-full transition-colors"
          >
            Entrar
          </Link>
          <Link
            to="/auth/register"
            className="btn btn-sm btn-neutral rounded-full px-4"
          >
            Começar grátis
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-[1.15fr_0.85fr] gap-16 items-center">
        <div className="stagger">
          <span className="chip chip-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary anim-pulse-soft" />
            Beta · feito no Brasil
          </span>
          <h1 className="font-display font-bold text-5xl md:text-6xl leading-[1.02] tracking-tight mt-5 text-balance">
            Atendimento e pipeline,{' '}
            <span className="bg-gradient-to-br from-primary via-primary to-accent bg-clip-text text-transparent">
              num lugar só
            </span>
            .
          </h1>
          <p className="text-lg text-base-content/70 mt-6 max-w-xl text-pretty leading-relaxed">
            CRM enxuto para times de marketing digital. Receba conversas do
            WhatsApp, mova leads pelo seu funil e converta — sem trocar de aba.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Link
              to="/auth/register"
              className="btn btn-neutral btn-md rounded-full px-5 gap-2"
            >
              Criar conta
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/auth/login"
              className="btn btn-ghost btn-md rounded-full px-5 border border-base-200 hover:border-base-content/20"
            >
              Já tenho conta
            </Link>
          </div>
          <p className="text-xs text-base-content/50 mt-4">
            Sem cartão de crédito. Cancela quando quiser.
          </p>
        </div>

        <div className="relative anim-fade-up">
          <div className="absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/15 via-transparent to-accent/15 blur-2xl" />
          <div className="surface-elevated rounded-[1.75rem] p-5 ring-1 ring-base-content/5">
            <div className="flex items-center gap-2 pb-4 border-b border-base-200">
              <span className="w-2.5 h-2.5 rounded-full bg-error/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-warning/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-success/70" />
              <span className="ml-auto text-[11px] text-base-content/40 font-mono">
                crmeffect.app
              </span>
            </div>
            <ul className="mt-4 space-y-3">
              {[
                {
                  icon: MessageCircle,
                  title: 'Caixa de entrada do WhatsApp',
                  body: 'Veja todas as conversas e responda direto pelo CRM.',
                },
                {
                  icon: Layout,
                  title: 'Pipeline customizável',
                  body: 'Crie etapas, mova cards e acompanhe o tempo em cada fase.',
                },
                {
                  icon: Users,
                  title: 'Equipe sem fricção',
                  body: 'Convide agentes, defina permissões e mantenha tudo seguro.',
                },
              ].map(({ icon: Icon, title, body }) => (
                <li
                  key={title}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-base-200/60 transition-colors"
                >
                  <span className="w-9 h-9 rounded-lg bg-primary/12 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{title}</p>
                    <p className="text-xs text-base-content/60 mt-0.5 leading-snug">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>

      <footer className="relative max-w-6xl mx-auto px-6 pb-8 text-xs text-base-content/45 flex flex-wrap items-center justify-between gap-2">
        <span>© {new Date().getFullYear()} CRM Effect</span>
        <span>Construído com carinho em Português 🇧🇷</span>
      </footer>
    </div>
  )
}
