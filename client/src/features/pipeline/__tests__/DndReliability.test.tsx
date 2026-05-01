import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  CSS: { Transform: { toString: (t: unknown) => String(t ?? '') } },
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
const LEAD_ID = '00000000-0000-0000-0002-000000000001'

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
    name: 'Vazio',
    order: 2,
    isDefaultEntry: false,
    color: '#3b82f6',
    description: null,
  },
]

const leads = [
  {
    id: LEAD_ID,
    displayName: 'Alice',
    phoneNumber: '+351912345678',
    stageId: STAGE1_ID,
    position: 1024,
    createdAt: '2024-01-01T10:00:00.000Z',
    updatedAt: '2024-01-01T10:00:00.000Z',
    customValues: null,
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

describe('DnD reliability', () => {
  beforeEach(() => {
    captured.onDragEnd = undefined
    overrideHandler(
      http.get('/api/pipeline/stages', () => HttpResponse.json({ stages })),
      http.get('/api/pipeline/leads', () =>
        HttpResponse.json({ leads, nextCursor: null }),
      ),
      http.get('/api/pipeline/custom-fields', () =>
        HttpResponse.json({ fields: [] }),
      ),
    )
  })

  it('drop with no over does not crash', async () => {
    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Alice')

    expect(() => {
      captured.onDragEnd?.({
        active: {
          id: LEAD_ID,
          data: { current: {} },
          rect: { current: { initial: null, translated: null } },
        },
        over: null,
        delta: { x: 0, y: 0 },
        activatorEvent: {} as Event,
        collisions: [],
      })
    }).not.toThrow()

    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('drop on empty column commits with position=1024', async () => {
    let patchBody: { stageId: string; position?: number } | null = null
    overrideHandler(
      http.patch(
        `/api/pipeline/leads/${LEAD_ID}/stage`,
        async ({ request }) => {
          patchBody = (await request.json()) as {
            stageId: string
            position?: number
          }
          return HttpResponse.json({})
        },
      ),
    )

    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Alice')

    captured.onDragEnd?.({
      active: {
        id: LEAD_ID,
        data: { current: {} },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: STAGE2_ID,
        data: { current: {} },
        rect: {
          width: 288,
          height: 400,
          left: 300,
          top: 0,
          right: 588,
          bottom: 400,
        },
      },
      delta: { x: 300, y: 0 },
      activatorEvent: {} as Event,
      collisions: [],
    } as unknown as DragEndEvent)

    await waitFor(() => expect(patchBody).not.toBeNull())
    expect(patchBody!.stageId).toBe(STAGE2_ID)
    expect(patchBody!.position).toBe(1024)
  })

  it('drop on column body below last card commits the move', async () => {
    let patchBody: { stageId: string; position?: number } | null = null
    overrideHandler(
      http.patch(
        `/api/pipeline/leads/${LEAD_ID}/stage`,
        async ({ request }) => {
          patchBody = (await request.json()) as {
            stageId: string
            position?: number
          }
          return HttpResponse.json({})
        },
      ),
    )

    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Alice')

    // Drop back on same column (below last card) — over = stage itself
    captured.onDragEnd?.({
      active: {
        id: LEAD_ID,
        data: { current: {} },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: STAGE2_ID,
        data: { current: {} },
        rect: {
          width: 288,
          height: 400,
          left: 300,
          top: 0,
          right: 588,
          bottom: 400,
        },
      },
      delta: { x: 300, y: 200 },
      activatorEvent: {} as Event,
      collisions: [],
    } as unknown as DragEndEvent)

    await waitFor(() => expect(patchBody).not.toBeNull())
    expect(patchBody!.stageId).toBe(STAGE2_ID)
  })
})
