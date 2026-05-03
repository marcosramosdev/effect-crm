import { createFileRoute } from '@tanstack/react-router'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardBody, CardHeader } from '../../../components/Card'
import { PromoCard } from '../../../components/PromoCard'
import { DashboardLayout } from '../../../features/shell/DashboardLayout'
import {
  MOCK_KANBAN_COLUMNS,
  MOCK_KPIS,
  MOCK_PROMO,
} from '../../../features/shell/mockData'

export const Route = createFileRoute('/app/dashboard/')({
  component: DashboardPage,
})

export function DashboardPage() {
  return (
    <DashboardLayout
      title="Painel"
      subtitle="Visão geral do atendimento e do pipeline"
    >
      <div className="flex flex-col gap-8 max-w-7xl mx-auto w-full">
        <KpiGrid />
        <KanbanPreview />
      </div>
    </DashboardLayout>
  )
}

function KpiGrid() {
  return (
    <section
      aria-label="Indicadores"
      className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger"
    >
      {MOCK_KPIS.map((kpi) => {
        const positive = kpi.delta >= 0
        return (
          <Card key={kpi.id} data-testid="kpi-tile" className="overflow-hidden">
            <CardBody className="gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-base-content/55 uppercase tracking-[0.16em] font-semibold">
                  {kpi.label}
                </p>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                    positive
                      ? 'bg-success/12 text-success'
                      : 'bg-error/12 text-error'
                  }`}
                >
                  {positive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {positive ? '+' : ''}
                  {kpi.delta}
                </span>
              </div>
              <p className="font-display text-4xl font-bold tabular-nums leading-none tracking-tight">
                {kpi.value}
              </p>
              <p className="text-xs text-base-content/55">esta semana</p>
            </CardBody>
          </Card>
        )
      })}
    </section>
  )
}

function KanbanPreview() {
  return (
    <section
      aria-label="Prévia do pipeline"
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5"
    >
      {MOCK_KANBAN_COLUMNS.map((col) => (
        <div
          key={col.id}
          className="flex flex-col gap-3 rounded-2xl border border-base-200 bg-base-100/60 p-3"
        >
          <div className="flex items-center gap-2 px-1">
            <span className={`h-2 w-2 rounded-full ${col.dot}`} />
            <h2
              className="font-display font-semibold text-sm text-base-content"
              data-testid="kanban-column-header"
            >
              {col.label}
            </h2>
            <span className="ml-auto chip text-[10px]">{col.leads.length}</span>
          </div>

          <div className="flex flex-col gap-2">
            {col.leads.map((lead) => (
              <Card key={lead.id} className="hover:border-base-content/15">
                <CardHeader className="gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{lead.city}</p>
                    <p className="text-[11px] text-base-content/50 font-mono mt-0.5">
                      {lead.code}
                    </p>
                  </div>
                  <span className="badge badge-sm badge-ghost shrink-0 rounded-full">
                    {lead.status}
                  </span>
                </CardHeader>
                <CardBody className="py-2.5 gap-1">
                  <p className="text-xs text-base-content/60">
                    Atribuído a{' '}
                    <span className="font-medium text-base-content">
                      {lead.assignedTo}
                    </span>
                  </p>
                  <p className="text-xs text-base-content/60">
                    Expira{' '}
                    <span className="font-medium text-base-content">
                      {lead.expAt}
                    </span>
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <PromoCard
        title={MOCK_PROMO.title}
        body={MOCK_PROMO.body}
        ctaLabel={MOCK_PROMO.ctaLabel}
      />
    </section>
  )
}
