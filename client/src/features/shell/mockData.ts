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
  { id: 'completed', label: 'Convertidos', value: 10, delta: 5 },
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
        city: 'São Paulo, SP',
        assignedTo: 'Ana Silva',
        expAt: '12 abr',
        status: 'Novo',
      },
      {
        id: 'l2',
        code: '#324561325',
        city: 'Rio de Janeiro, RJ',
        assignedTo: 'Rui Costa',
        expAt: '18 abr',
        status: 'Novo',
      },
    ],
  },
  {
    id: 'contacted',
    label: 'Contatado',
    dot: 'bg-info',
    leads: [
      {
        id: 'l3',
        code: '#842391056',
        city: 'Belo Horizonte, MG',
        assignedTo: 'Marta Lopes',
        expAt: '14 abr',
        status: 'Contatado',
      },
      {
        id: 'l4',
        code: '#772394810',
        city: 'Curitiba, PR',
        assignedTo: 'João Souza',
        expAt: '19 abr',
        status: 'Contatado',
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
        city: 'Florianópolis, SC',
        assignedTo: 'Inês Ferreira',
        expAt: '15 abr',
        status: 'Ganho',
      },
    ],
  },
]

export const MOCK_PROMO: Promo = {
  title: 'Análises avançadas para o seu funil',
  body: 'Veja conversão por etapa, tempo médio e desempenho do time num só lugar.',
  ctaLabel: 'Conhecer Premium',
}
