import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { overrideHandler } from '../../../test/msw/server'
import { PipelineBoard } from '../PipelineBoard'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
      signOut: vi.fn(),
    },
  },
}))

let mockRole: 'owner' | 'agent' = 'owner'

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    data: {
      userId: 'u1',
      email: 'owner@test.com',
      tenantId: 't1',
      tenantName: 'Test',
      role: mockRole,
    },
  }),
  authQueryOptions: {
    queryKey: ['auth', 'me'],
    queryFn: () => Promise.resolve(null),
  },
}))

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: { children: ReactNode }) => (
    <div data-testid="dnd-context">{children}</div>
  ),
  Droppable: ({
    children,
    droppableId,
  }: {
    children: (p: object, s: object) => ReactNode
    droppableId: string
  }) =>
    children(
      {
        innerRef: () => {},
        droppableProps: { 'data-rfd-droppable-id': droppableId },
        placeholder: null,
      },
      {
        isDraggingOver: false,
        draggingOverWith: null,
        draggingFromThisWith: null,
        isUsingPlaceholder: false,
      },
    ),
  Draggable: ({
    children,
    draggableId,
    index,
  }: {
    children: (p: object, s: object, r: object) => ReactNode
    draggableId: string
    index: number
  }) =>
    children(
      { innerRef: () => {}, draggableProps: {}, dragHandleProps: {} },
      {
        isDragging: false,
        isDropAnimating: false,
        isClone: false,
        dropAnimation: null,
        draggingOver: null,
        combineWith: null,
        combineTargetFor: null,
        mode: null,
      },
      {
        draggableId,
        type: 'DEFAULT',
        source: { droppableId: 'unknown', index },
      },
    ),
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  LayoutGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  Reorder: {
    Group: ({ children }: { children: ReactNode }) => <>{children}</>,
    Item: ({ children }: { children: ReactNode }) => <>{children}</>,
  },
}))

const STAGE1_ID = '00000000-0000-0000-0003-000000000001'
const STAGE2_ID = '00000000-0000-0000-0003-000000000002'

const stages = [
  {
    id: STAGE1_ID,
    name: 'Novo',
    order: 1,
    isDefaultEntry: true,
    color: '#22c55e',
    description: null,
  },
  {
    id: STAGE2_ID,
    name: 'Em conversa',
    order: 2,
    isDefaultEntry: false,
    color: '#3b82f6',
    description: null,
  },
]

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

function setupHandlers() {
  overrideHandler(
    http.get('/api/pipeline/stages', () => HttpResponse.json({ stages })),
    http.get('/api/pipeline/leads', () =>
      HttpResponse.json({ leads: [], nextCursor: null }),
    ),
    http.get('/api/pipeline/custom-fields', () =>
      HttpResponse.json({ fields: [] }),
    ),
  )
}

describe('Stage management — owner', () => {
  beforeEach(() => {
    mockRole = 'owner'
    setupHandlers()
  })

  it('owner sees column menu button', async () => {
    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Novo')
    expect(screen.getAllByLabelText(/Opções de/)[0]).toBeInTheDocument()
  })

  it('owner sees + add stage button', async () => {
    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Novo')
    expect(screen.getByLabelText('Adicionar etapa')).toBeInTheDocument()
  })

  it('clicking + shows create form', async () => {
    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Novo')
    fireEvent.click(screen.getByLabelText('Adicionar etapa'))
    expect(screen.getByPlaceholderText('Nome da etapa...')).toBeInTheDocument()
  })

  it('create form submits POST /pipeline/stages', async () => {
    let postedName: string | null = null
    overrideHandler(
      http.post('/api/pipeline/stages', async ({ request }) => {
        const body = (await request.json()) as { name: string }
        postedName = body.name
        return HttpResponse.json({
          id: 'new-id',
          name: body.name,
          order: 3,
          isDefaultEntry: false,
          color: '#64748b',
          description: null,
        })
      }),
    )

    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Novo')
    fireEvent.click(screen.getByLabelText('Adicionar etapa'))
    fireEvent.change(screen.getByPlaceholderText('Nome da etapa...'), {
      target: { value: 'Fechado' },
    })
    fireEvent.submit(
      screen.getByPlaceholderText('Nome da etapa...').closest('form')!,
    )

    await waitFor(() => expect(postedName).toBe('Fechado'))
  })

  it('inline rename round-trips via PATCH', async () => {
    let patchedBody: unknown = null
    overrideHandler(
      http.patch(`/api/pipeline/stages/${STAGE1_ID}`, async ({ request }) => {
        patchedBody = await request.json()
        return HttpResponse.json({ ...stages[0], name: 'Renomeado' })
      }),
    )

    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Novo')

    const badge = screen.getAllByTitle('Duplo clique para renomear')[0]
    fireEvent.dblClick(badge)

    const input = screen.getByLabelText('Renomear etapa')
    fireEvent.change(input, { target: { value: 'Renomeado' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(patchedBody).toEqual({ name: 'Renomeado' }))
  })
})

describe('Stage management — agent', () => {
  beforeEach(() => {
    mockRole = 'agent'
    setupHandlers()
  })

  it('agent does not see column menu', async () => {
    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Novo')
    expect(screen.queryByLabelText(/Opções de/)).not.toBeInTheDocument()
  })

  it('agent does not see + add stage button', async () => {
    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Novo')
    expect(screen.queryByLabelText('Adicionar etapa')).not.toBeInTheDocument()
  })
})
