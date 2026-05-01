import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import type { DragEndEvent } from '@dnd-kit/core'
import { overrideHandler } from '../../../test/msw/server'
import { PipelineBoard } from '../PipelineBoard'

const captured = vi.hoisted(() => ({
  onDragEnd: undefined as ((e: DragEndEvent) => void) | undefined,
}))

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

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode
    onDragStart?: () => void
    onDragOver?: () => void
    onDragEnd?: (e: DragEndEvent) => void
  }) => {
    captured.onDragEnd = onDragEnd
    return <div data-testid="dnd-context">{children}</div>
  },
  DragOverlay: ({ children }: { children: ReactNode }) => <>{children}</>,
  useSensor: () => ({}),
  useSensors: () => ({}),
  closestCorners: () => [],
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    isDragging: false,
  }),
  KeyboardSensor: {},
  PointerSensor: {},
}))

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: ({ id }: { id: string }) => ({
    attributes: { 'data-sortable-id': id },
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
    isDragging: false,
  }),
  SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  arrayMove: (arr: unknown[], from: number, to: number) => {
    const result = [...arr]
    const [item] = result.splice(from, 1)
    result.splice(to, 0, item)
    return result
  },
  verticalListSortingStrategy: {},
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
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
    captured.onDragEnd = undefined
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

  it('column reorder drag fires reorder mutation', async () => {
    let reorderBody: unknown = null
    overrideHandler(
      http.patch('/api/pipeline/stages/reorder', async ({ request }) => {
        reorderBody = await request.json()
        return HttpResponse.json({})
      }),
    )

    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Novo')

    captured.onDragEnd?.({
      active: {
        id: `column-${STAGE1_ID}`,
        data: { current: { type: 'column', id: STAGE1_ID } },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: STAGE2_ID,
        data: { current: {} },
        rect: {
          width: 288,
          height: 600,
          left: 300,
          top: 0,
          right: 588,
          bottom: 600,
        },
      },
      delta: { x: 300, y: 0 },
      activatorEvent: {} as Event,
      collisions: [],
    } as unknown as DragEndEvent)

    await waitFor(() => expect(reorderBody).not.toBeNull())
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
