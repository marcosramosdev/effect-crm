import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { useLeads, useStages, useCustomFields } from './api'
import { LeadFormModal } from './LeadFormModal'
import type {
  PipelineLead,
  PipelineStage,
  CustomFieldDef,
} from '@shared/pipeline'

type SortKey = 'displayName' | 'appointmentDate' | 'timeInStage'
type SortDir = 'asc' | 'desc'

function formatTimeInStage(updatedAt: string): string {
  const ms = Date.now() - new Date(updatedAt).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days > 0) return `${days}d`
  const hours = Math.floor(ms / 3_600_000)
  if (hours > 0) return `${hours}h`
  return '<1h'
}

function getCustomValue(
  lead: PipelineLead,
  fields: CustomFieldDef[],
  key: string,
): string | null {
  const field = fields.find((f) => f.key === key)
  if (!field) return null
  return lead.customValues?.[field.id] ?? null
}

function sortLeads(
  leads: PipelineLead[],
  fields: CustomFieldDef[],
  sortKey: SortKey,
  sortDir: SortDir,
): PipelineLead[] {
  return [...leads].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'displayName') {
      cmp = (a.displayName ?? '').localeCompare(b.displayName ?? '')
    } else if (sortKey === 'appointmentDate') {
      const aVal = getCustomValue(a, fields, 'appointmentDate') ?? ''
      const bVal = getCustomValue(b, fields, 'appointmentDate') ?? ''
      cmp = aVal.localeCompare(bVal)
    } else {
      cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    }
    return sortDir === 'asc' ? cmp : -cmp
  })
}

interface SortHeaderProps {
  label: string
  sortKey: SortKey
  active: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
}

function SortHeader({ label, sortKey, active, dir, onSort }: SortHeaderProps) {
  const isActive = active === sortKey
  return (
    <th
      className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wider font-semibold text-base-content/60 cursor-pointer select-none whitespace-nowrap"
      aria-sort={
        isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'
      }
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive ? (
          dir === 'asc' ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ChevronDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  )
}

interface ModalState {
  open: boolean
  lead?: PipelineLead
  stageId?: string
}

export function LeadListView() {
  const { data: leadsData, isLoading: leadsLoading } = useLeads()
  const { data: stagesData, isLoading: stagesLoading } = useStages()
  const { data: fieldsData } = useCustomFields()

  const [sortKey, setSortKey] = useState<SortKey>('displayName')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [modal, setModal] = useState<ModalState>({ open: false })

  const leads = leadsData?.leads ?? []
  const stages = stagesData?.stages ?? []
  const fields = fieldsData?.fields ?? []

  const stageMap = new Map<string, PipelineStage>(stages.map((s) => [s.id, s]))

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = sortLeads(leads, fields, sortKey, sortDir)

  if (leadsLoading || stagesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="loading loading-spinner loading-md" />
      </div>
    )
  }

  return (
    <>
      <div className="overflow-auto h-full">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-base-100 border-b border-base-300 z-10">
            <tr>
              <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wider font-semibold text-base-content/60 whitespace-nowrap">
                Etapa
              </th>
              <SortHeader
                label="Nome"
                sortKey="displayName"
                active={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wider font-semibold text-base-content/60">
                Telefone
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wider font-semibold text-base-content/60">
                Email
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wider font-semibold text-base-content/60">
                Instagram
              </th>
              <SortHeader
                label="Compromisso"
                sortKey="appointmentDate"
                active={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortHeader
                label="Tempo na etapa"
                sortKey="timeInStage"
                active={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((lead) => {
              const stage = stageMap.get(lead.stageId)
              const email = getCustomValue(lead, fields, 'email')
              const instagram = getCustomValue(lead, fields, 'instagram')
              const apptDate = getCustomValue(lead, fields, 'appointmentDate')
              return (
                <tr
                  key={lead.id}
                  className="border-b border-base-200 hover:bg-base-200/50 cursor-pointer transition-colors"
                  onClick={() =>
                    setModal({ open: true, lead, stageId: lead.stageId })
                  }
                >
                  <td className="px-3 py-2.5">
                    {stage && (
                      <span
                        className="badge badge-sm gap-1"
                        style={{
                          backgroundColor: `${stage.color}20`,
                          borderColor: stage.color,
                          color: stage.color,
                        }}
                      >
                        {stage.name}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-base-content">
                    {lead.displayName ?? (
                      <span className="text-base-content/40">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-base-content/70">
                    {lead.phoneNumber.startsWith('manual:') ? (
                      <span className="text-base-content/40">—</span>
                    ) : (
                      lead.phoneNumber
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-base-content/70">
                    {email ?? <span className="text-base-content/40">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-base-content/70">
                    {instagram ? (
                      `@${instagram.replace(/^@/, '')}`
                    ) : (
                      <span className="text-base-content/40">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-base-content/70">
                    {apptDate ?? (
                      <span className="text-base-content/40">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-base-content/50 tabular-nums">
                    {formatTimeInStage(lead.updatedAt)}
                  </td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-16 text-center text-base-content/40 text-sm"
                >
                  Nenhum lead encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <LeadFormModal
        open={modal.open}
        mode="edit"
        lead={modal.lead}
        stageId={modal.stageId}
        onClose={() => setModal({ open: false })}
      />
    </>
  )
}
