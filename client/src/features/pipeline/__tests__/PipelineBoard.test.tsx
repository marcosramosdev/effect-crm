import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
  act,
} from '@testing-library/react'
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

const STAGE1_ID = '00000000-0000-0000-0003-000000000001'
const STAGE2_ID = '00000000-0000-0000-0003-000000000002'
const LEAD_ID = '00000000-0000-0000-0002-000000000001'

const stages = [
  { id: STAGE1_ID, name: 'Novo', order: 1, isDefaultEntry: true },
  { id: STAGE2_ID, name: 'Em conversa', order: 2, isDefaultEntry: false },
]

const leads = [
  {
    id: LEAD_ID,
    displayName: 'Alice',
    phoneNumber: '+351912345678',
    stageId: STAGE1_ID,
    createdAt: '2024-01-01T10:00:00.000Z',
    updatedAt: '2024-01-01T10:00:00.000Z',
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
    overrideHandler(
      http.get('/api/pipeline/stages', () => HttpResponse.json({ stages })),
      http.get('/api/pipeline/leads', () =>
        HttpResponse.json({ leads, nextCursor: null }),
      ),
    )
  })

  // T-C-030
  it('drag-and-drop between columns fires PATCH /api/pipeline/leads/:id/stage', async () => {
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

    await screen.findByText('Novo')
    await screen.findByText('Alice')

    const stage2List = screen.getByRole('list', { name: 'Em conversa' })
    const aliceCard = screen
      .getByText('Alice')
      .closest('[draggable]') as HTMLElement

    fireEvent.dragStart(aliceCard)
    fireEvent.dragOver(stage2List)
    fireEvent.drop(stage2List)

    await waitFor(() => {
      expect(patchedLeadId).toBe(LEAD_ID)
      expect(patchedStageId).toBe(STAGE2_ID)
    })
  })

  // T-C-031
  it('optimistic update moves lead immediately and reverts on error', async () => {
    let patchResolve!: (r: Response) => void

    overrideHandler(
      http.patch(
        '/api/pipeline/leads/:leadId/stage',
        () =>
          new Promise<Response>((resolve) => {
            patchResolve = resolve
          }),
      ),
    )

    render(<PipelineBoard />, { wrapper: makeWrapper() })

    await screen.findByText('Alice')

    const stage1List = screen.getByRole('list', { name: 'Novo' })
    const stage2List = screen.getByRole('list', { name: 'Em conversa' })
    const aliceCard = within(stage1List)
      .getByText('Alice')
      .closest('[draggable]') as HTMLElement

    fireEvent.dragStart(aliceCard)
    fireEvent.dragOver(stage2List)
    fireEvent.drop(stage2List)

    // Optimistic: Alice should appear in stage 2 immediately
    await waitFor(() => {
      expect(within(stage2List).getByText('Alice')).toBeInTheDocument()
    })
    expect(within(stage1List).queryByText('Alice')).not.toBeInTheDocument()

    // Resolve with server error → triggers rollback
    act(() => {
      patchResolve(
        HttpResponse.json({ error: 'Server error' }, { status: 500 }),
      )
    })

    // After rollback, Alice should be back in stage 1
    await waitFor(() => {
      expect(within(stage1List).getByText('Alice')).toBeInTheDocument()
    })
    expect(within(stage2List).queryByText('Alice')).not.toBeInTheDocument()
  })
})
