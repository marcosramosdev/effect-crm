export type KPI = {
  id: string
  label: string
  value: number
  delta: number
}

export type KanbanLead = {
  id: string
  code: string
  city: string
  assignedTo: string
  expAt: string
  status: string
}

export type KanbanColumn = {
  id: string
  label: string
  dot: string
  leads: KanbanLead[]
}

export type Promo = {
  title: string
  body: string
  ctaLabel: string
}

export const MOCK_KPIS: KPI[] = [
  { id: 'pending', label: 'Pendentes', value: 4, delta: 1 },
  { id: 'responded', label: 'Respondidos', value: 12, delta: -2 },
  { id: 'assigned', label: 'Atribuídos', value: 15, delta: 3 },
  { id: 'completed', label: 'Concluídos', value: 10, delta: 5 },
]

export const MOCK_KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'new',
    label: 'Novo',
    dot: 'bg-warning',
    leads: [
      {
        id: 'l1',
        code: '#324561324',
        city: 'Lisboa, PT',
        assignedTo: 'Ana Silva',
        expAt: '12 Abr',
        status: 'Novo',
      },
      {
        id: 'l2',
        code: '#324561325',
        city: 'Porto, PT',
        assignedTo: 'Rui Costa',
        expAt: '18 Abr',
        status: 'Novo',
      },
    ],
  },
  {
    id: 'contacted',
    label: 'Contactado',
    dot: 'bg-info',
    leads: [
      {
        id: 'l3',
        code: '#842391056',
        city: 'Braga, PT',
        assignedTo: 'Marta Lopes',
        expAt: '14 Abr',
        status: 'Contactado',
      },
      {
        id: 'l4',
        code: '#772394810',
        city: 'Faro, PT',
        assignedTo: 'João Sousa',
        expAt: '19 Abr',
        status: 'Contactado',
      },
    ],
  },
  {
    id: 'won',
    label: 'Ganho',
    dot: 'bg-success',
    leads: [
      {
        id: 'l5',
        code: '#194827364',
        city: 'Coimbra, PT',
        assignedTo: 'Inês Ferreira',
        expAt: '15 Abr',
        status: 'Ganho',
      },
    ],
  },
]

export const MOCK_PROMO: Promo = {
  title: 'Analíticas avançadas',
  body: 'Obtenha insights detalhados sobre o seu pipeline e equipa.',
  ctaLabel: 'Ver Premium',
}
