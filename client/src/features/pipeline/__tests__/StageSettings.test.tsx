import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { overrideHandler } from '../../../test/msw/server'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
      signOut: vi.fn(),
    },
  },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))

const STAGE1_ID = '00000000-0000-0000-0004-000000000001'
const STAGE2_ID = '00000000-0000-0000-0004-000000000002'

const stages = [
  { id: STAGE1_ID, name: 'Novo', order: 1, isDefaultEntry: true },
  { id: STAGE2_ID, name: 'Em conversa', order: 2, isDefaultEntry: false },
]

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('StageSettings', () => {
  beforeEach(() => {
    overrideHandler(
      http.get('/api/pipeline/stages', () => HttpResponse.json({ stages })),
    )
  })

  // T-C-032
  it('allows owner to reorder stages by drag-and-drop', async () => {
    let patchedStageId: string | null = null
    let patchedOrder: number | null = null

    overrideHandler(
      http.patch(
        '/api/pipeline/stages/:stageId',
        async ({ params, request }) => {
          patchedStageId = params.stageId as string
          const body = (await request.json()) as { order?: number }
          patchedOrder = body.order ?? null
          return HttpResponse.json({
            stage: { ...stages[1], order: body.order },
          })
        },
      ),
    )

    const { StageSettings } = await import('../StageSettings')
    render(<StageSettings />, { wrapper: makeWrapper() })

    await screen.findByText('Novo')
    await screen.findByText('Em conversa')

    const stage2Item = screen
      .getByText('Em conversa')
      .closest('[draggable]') as HTMLElement
    const stage1Item = screen
      .getByText('Novo')
      .closest('[draggable]') as HTMLElement

    fireEvent.dragStart(stage2Item)
    fireEvent.dragOver(stage1Item)
    fireEvent.drop(stage1Item)

    await waitFor(() => {
      expect(patchedStageId).toBe(STAGE2_ID)
      expect(patchedOrder).toBe(1)
    })
  })

  // T-C-033
  it('shows destination modal when removing stage with leads; cancel does not trigger DELETE', async () => {
    let deleteCount = 0

    overrideHandler(
      http.delete('/api/pipeline/stages/:stageId', () => {
        deleteCount++
        return HttpResponse.json(
          {
            error: {
              code: 'STAGE_HAS_LEADS',
              message: 'A etapa tem leads.',
              details: { leadsAffected: 3 },
            },
          },
          { status: 409 },
        )
      }),
    )

    const { StageSettings } = await import('../StageSettings')
    render(<StageSettings />, { wrapper: makeWrapper() })

    await screen.findByText('Em conversa')

    const [deleteButton] = screen.getAllByRole('button', { name: /apagar/i })
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByText(/3/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    expect(deleteCount).toBe(1)
  })
})

// T-C-034
describe('NavMenu', () => {
  it('agent does not see /settings/pipeline link', async () => {
    const { NavMenu } = await import('../../../components/NavMenu')
    render(<NavMenu />, { wrapper: makeWrapper() })

    await screen.findByRole('link', { name: /inbox/i })

    expect(
      screen.queryByRole('link', { name: /configurar pipeline/i }),
    ).not.toBeInTheDocument()
  })
})
