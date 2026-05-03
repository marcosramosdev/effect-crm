import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import type { DropResult } from '@hello-pangea/dnd'
import { overrideHandler } from '../../../test/msw/server'
import { PipelineBoard } from '../PipelineBoard'

const captured = vi.hoisted(() => ({
  onDragEnd: undefined as ((r: DropResult) => void) | undefined,
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

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode
    onDragEnd: (r: DropResult) => void
  }) => {
    captured.onDragEnd = onDragEnd
    return <div data-testid="dnd-context">{children}</div>
  },
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

  it('drop with no destination does not crash', async () => {
    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Alice')

    expect(() => {
      captured.onDragEnd?.({
        draggableId: LEAD_ID,
        type: 'DEFAULT',
        mode: 'FLUID',
        reason: 'CANCEL',
        source: { droppableId: STAGE1_ID, index: 0 },
        destination: null,
        combine: null,
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
      draggableId: LEAD_ID,
      type: 'DEFAULT',
      mode: 'FLUID',
      reason: 'DROP',
      source: { droppableId: STAGE1_ID, index: 0 },
      destination: { droppableId: STAGE2_ID, index: 0 },
      combine: null,
    })

    await waitFor(() => expect(patchBody).not.toBeNull())
    expect(patchBody!.stageId).toBe(STAGE2_ID)
    expect(patchBody!.position).toBe(1024)
  })

  it('cross-column move fires PATCH mutation', async () => {
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
      draggableId: LEAD_ID,
      type: 'DEFAULT',
      mode: 'FLUID',
      reason: 'DROP',
      source: { droppableId: STAGE1_ID, index: 0 },
      destination: { droppableId: STAGE2_ID, index: 1 },
      combine: null,
    })

    await waitFor(() => expect(patchBody).not.toBeNull())
    expect(patchBody!.stageId).toBe(STAGE2_ID)
  })
})
