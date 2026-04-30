import { createFileRoute } from '@tanstack/react-router'
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
  const filters = MOCK_KPIS.map((kpi) => ({
    label: kpi.label,
    count: kpi.value,
  }))

  return (
    <DashboardLayout title="Dashboard" filters={filters}>
      <div className="flex flex-col gap-6">
        <KpiGrid />
        <KanbanPreview />
      </div>
    </DashboardLayout>
  )
}

function KpiGrid() {
  return (
    <section
      aria-label="KPIs"
      className="grid grid-cols-2 sm:grid-cols-4 gap-4"
    >
      {MOCK_KPIS.map((kpi) => (
        <Card key={kpi.id} data-testid="kpi-tile">
          <CardBody className="gap-1">
            <p className="text-xs text-base-content/60 uppercase tracking-wide">
              {kpi.label}
            </p>
            <p className="text-3xl font-bold">{kpi.value}</p>
            <p
              className={`text-xs font-medium ${kpi.delta >= 0 ? 'text-success' : 'text-error'}`}
            >
              {kpi.delta >= 0 ? '+' : ''}
              {kpi.delta} esta semana
            </p>
          </CardBody>
        </Card>
      ))}
    </section>
  )
}

function KanbanPreview() {
  return (
    <section
      aria-label="Pipeline preview"
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      {MOCK_KANBAN_COLUMNS.map((col) => (
        <div key={col.id} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${col.dot}`} />
            <h2
              className="text-sm font-semibold text-base-content"
              data-testid="kanban-column-header"
            >
              {col.label}
            </h2>
            <span className="badge badge-sm ml-auto">{col.leads.length}</span>
          </div>

          <div className="flex flex-col gap-2">
            {col.leads.map((lead) => (
              <Card key={lead.id}>
                <CardHeader className="gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{lead.city}</p>
                    <p className="text-xs text-base-content/50">{lead.code}</p>
                  </div>
                  <span className="badge badge-sm badge-ghost shrink-0">
                    {lead.status}
                  </span>
                </CardHeader>
                <CardBody className="py-2 gap-0.5">
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
