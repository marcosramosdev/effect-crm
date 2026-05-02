import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import React from 'react'
import { overrideHandler } from '../../../test/msw/server'
import { PipelineBoard } from '../PipelineBoard'
import type { PipelineLead, PipelineStage } from '@shared/pipeline'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
      signOut: vi.fn(),
    },
  },
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

// Capture onMove so tests can trigger drops without real DnD
let capturedOnMove:
  | ((leadId: string, stageId: string, position: number) => void)
  | undefined

vi.mock('../dnd-pangea/PipelineBoardDnd', () => ({
  PipelineBoardDnd: ({
    stages,
    leads,
    onMove,
    renderColumnHeader,
    renderCard,
    renderEmptyColumn,
    renderBoardFooter,
  }: {
    stages: PipelineStage[]
    leads: PipelineLead[]
    onMove: (leadId: string, stageId: string, position: number) => void
    renderColumnHeader: (
      stage: PipelineStage,
      stageLeads: PipelineLead[],
    ) => ReactNode
    renderCard: (
      lead: PipelineLead,
      provided: {
        innerRef: (el: HTMLElement | null) => void
        draggableProps: { style: object; [k: string]: unknown }
        dragHandleProps: object | null
      },
      isDragging: boolean,
    ) => ReactNode
    renderEmptyColumn?: (stage: PipelineStage) => ReactNode
    renderBoardFooter?: () => ReactNode
  }) => {
    capturedOnMove = onMove
    return (
      <div data-testid="pipeline-board-dnd">
        {stages.map((stage) => {
          const stageLeads = leads
            .filter((l) => l.stageId === stage.id)
            .sort((a, b) => a.position - b.position)
          return (
            <div key={stage.id}>
              {renderColumnHeader(stage, stageLeads)}
              {stageLeads.length === 0 && renderEmptyColumn?.(stage)}
              {stageLeads.map((lead) => (
                <React.Fragment key={lead.id}>
                  {renderCard(
                    lead,
                    {
                      innerRef: () => {},
                      draggableProps: {
                        style: {},
                        'data-rbd-draggable-id': lead.id,
                      },
                      dragHandleProps: {},
                    },
                    false,
                  )}
                </React.Fragment>
              ))}
            </div>
          )
        })}
        {renderBoardFooter?.()}
      </div>
    )
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
    description: 'Novos leads',
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

describe('PipelineBoard', () => {
  beforeEach(() => {
    capturedOnMove = undefined
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

  it('renders all columns by name', async () => {
    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Em conversa')
    expect(screen.getAllByText('Novo').length).toBeGreaterThan(0)
    expect(screen.getByText('Em conversa')).toBeInTheDocument()
  })

  it('renders lead cards', async () => {
    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Alice')
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('renders columns with color strips', async () => {
    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Em conversa')

    const novoHeaders = screen.getAllByText('Novo')
    expect(novoHeaders.length).toBeGreaterThan(0)

    const novoHeader = novoHeaders[0].closest(
      'div[class*="border-t-4"]',
    ) as HTMLElement
    expect(novoHeader).toBeTruthy()
  })

  it('drag move calls mutation', async () => {
    let patchedLeadId: string | null = null
    let patchedStageId: string | null = null

    overrideHandler(
      http.patch(
        '/api/pipeline/leads/:leadId/stage',
        async ({ params, request }) => {
          patchedLeadId = params.leadId as string
          const body = (await request.json()) as { stageId: string }
          patchedStageId = body.stageId
          return HttpResponse.json({})
        },
      ),
    )

    render(<PipelineBoard />, { wrapper: makeWrapper() })
    await screen.findByText('Alice')

    act(() => {
      capturedOnMove?.(LEAD_ID, STAGE2_ID, 512)
    })

    await waitFor(() => {
      expect(patchedLeadId).toBe(LEAD_ID)
      expect(patchedStageId).toBe(STAGE2_ID)
    })
  })
})
