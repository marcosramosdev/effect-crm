import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: ReactNode }) => (
    <div data-testid="dnd-context">{children}</div>
  ),
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
  arrayMove: (arr: unknown[]) => arr,
  verticalListSortingStrategy: {},
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div> },
  LayoutGroup: ({ children }: { children: ReactNode }) => <>{children}</>,
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  Reorder: {
    Group: ({ children }: { children: ReactNode }) => <>{children}</>,
    Item: ({ children }: { children: ReactNode }) => <>{children}</>,
  },
}))

const STAGE_ID = '00000000-0000-0000-0003-000000000001'

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('Board horizontal scroll', () => {
  it('board container has overflow-x-auto and scroll-snap classes', async () => {
    overrideHandler(
      http.get('/api/pipeline/stages', () =>
        HttpResponse.json({
          stages: [{ id: STAGE_ID, name: 'Novo', order: 1, isDefaultEntry: true, color: '#22c55e', description: null }],
        }),
      ),
      http.get('/api/pipeline/leads', () =>
        HttpResponse.json({ leads: [], nextCursor: null }),
      ),
      http.get('/api/pipeline/custom-fields', () =>
        HttpResponse.json({ fields: [] }),
      ),
    )

    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Novo')

    const board = document.querySelector('.board-scroll')
    expect(board).not.toBeNull()
    expect(board?.classList.contains('overflow-x-auto')).toBe(true)
    expect(board?.className).toContain('scroll-smooth')
  })

  it('columns have scroll-snap-align class', async () => {
    overrideHandler(
      http.get('/api/pipeline/stages', () =>
        HttpResponse.json({
          stages: [{ id: STAGE_ID, name: 'Novo', order: 1, isDefaultEntry: true, color: '#22c55e', description: null }],
        }),
      ),
      http.get('/api/pipeline/leads', () =>
        HttpResponse.json({ leads: [], nextCursor: null }),
      ),
      http.get('/api/pipeline/custom-fields', () =>
        HttpResponse.json({ fields: [] }),
      ),
    )

    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Novo')

    const column = document.querySelector('[class*="scroll-snap-align"]')
    expect(column).not.toBeNull()
  })
})
