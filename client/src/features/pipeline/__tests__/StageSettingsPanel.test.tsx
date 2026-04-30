import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { overrideHandler } from '../../../test/msw/server'
import { StageSettingsPanel } from '../StageSettingsPanel'

vi.mock('framer-motion', () => ({
  Reorder: {
    Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Item: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
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

const STAGE1_ID = '00000000-0000-0000-0004-000000000001'
const STAGE2_ID = '00000000-0000-0000-0004-000000000002'

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('StageSettingsPanel', () => {
  beforeEach(() => {
    overrideHandler(
      http.get('/api/pipeline/stages', () =>
        HttpResponse.json({
          stages: [
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
          ],
        }),
      ),
    )
  })

  it('allows inline rename and recolor', async () => {
    let patchedBody: Record<string, unknown> | null = null

    overrideHandler(
      http.patch('/api/pipeline/stages/:stageId', async ({ request }) => {
        patchedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          stage: {
            id: STAGE1_ID,
            name: 'Renomeado',
            order: 1,
            isDefaultEntry: true,
            color: '#ef4444',
            description: 'Desc',
          },
        })
      }),
    )

    render(<StageSettingsPanel />, { wrapper: makeWrapper() })
    await screen.findByText('Novo')

    fireEvent.click(screen.getAllByRole('button', { name: /Editar/i })[0])

    fireEvent.change(screen.getAllByPlaceholderText('Nome da etapa')[0], {
      target: { value: 'Renomeado' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: /Guardar/i })[0])

    await waitFor(() => {
      expect(patchedBody).toMatchObject({ name: 'Renomeado', color: '#22c55e' })
    })
  })

  it('shows destination dropdown when deleting stage with leads', async () => {
    overrideHandler(
      http.delete('/api/pipeline/stages/:stageId', () =>
        HttpResponse.json(
          {
            error: {
              code: 'STAGE_HAS_LEADS',
              message: 'A etapa tem leads.',
              details: { leadsAffected: 3 },
            },
          },
          { status: 409 },
        ),
      ),
    )

    render(<StageSettingsPanel />, { wrapper: makeWrapper() })
    await screen.findByText('Em conversa')

    const deleteButtons = screen.getAllByRole('button', { name: /Apagar/i })
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByText(/3/)).toBeInTheDocument()
  })
})
