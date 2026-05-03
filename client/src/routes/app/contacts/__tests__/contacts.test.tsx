import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import type * as TanstackRouter from '@tanstack/react-router'
import { overrideHandler } from '../../../../test/msw/server'

let mockView: 'board' | 'list' = 'board'
const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof TanstackRouter>(
    '@tanstack/react-router',
  )
  return {
    ...actual,
    createFileRoute: () => (opts: Record<string, unknown>) => ({
      ...opts,
      useSearch: () => ({ view: mockView }),
    }),
    useNavigate: () => mockNavigate,
    useRouterState: ({
      select,
    }: {
      select: (s: { location: { pathname: string } }) => string
    }) => select({ location: { pathname: '/app/contacts' } }),
    Link: ({
      children,
      to,
      className,
      'aria-current': ariaCurrent,
    }: {
      children: ReactNode
      to: string
      className?: string
      'aria-current'?: React.AriaAttributes['aria-current']
    }) => (
      <a href={to} className={className} aria-current={ariaCurrent}>
        {children}
      </a>
    ),
  }
})

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
    },
  },
}))

vi.mock('../../../../features/pipeline/PipelineBoard', () => ({
  PipelineBoard: () => <div data-testid="pipeline-board" />,
}))

vi.mock('../../../../features/pipeline/LeadListView', () => ({
  LeadListView: () => <div data-testid="lead-list-view" />,
}))

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('ContactsPage', () => {
  beforeEach(() => {
    mockView = 'board'
    mockNavigate.mockClear()
  })

  it('renders board view by default', async () => {
    const mod = await import('../index')
    const ContactsPage = (
      mod.Route as unknown as { component: React.ComponentType }
    ).component
    render(<ContactsPage />, { wrapper: makeWrapper() })
    expect(screen.getByTestId('pipeline-board')).toBeInTheDocument()
    expect(screen.queryByTestId('lead-list-view')).not.toBeInTheDocument()
  })

  it('renders list view when ?view=list', async () => {
    mockView = 'list'
    const mod = await import('../index')
    const ContactsPage = (
      mod.Route as unknown as { component: React.ComponentType }
    ).component
    render(<ContactsPage />, { wrapper: makeWrapper() })
    expect(screen.getByTestId('lead-list-view')).toBeInTheDocument()
    expect(screen.queryByTestId('pipeline-board')).not.toBeInTheDocument()
  })

  it('clicking List tab navigates with view=list', async () => {
    const mod = await import('../index')
    const ContactsPage = (
      mod.Route as unknown as { component: React.ComponentType }
    ).component
    render(<ContactsPage />, { wrapper: makeWrapper() })
    fireEvent.click(screen.getByRole('tab', { name: 'List' }))
    expect(mockNavigate).toHaveBeenCalledWith({ search: { view: 'list' } })
  })

  it('clicking Board tab navigates with view=board', async () => {
    mockView = 'list'
    const mod = await import('../index')
    const ContactsPage = (
      mod.Route as unknown as { component: React.ComponentType }
    ).component
    render(<ContactsPage />, { wrapper: makeWrapper() })
    fireEvent.click(screen.getByRole('tab', { name: 'Board' }))
    expect(mockNavigate).toHaveBeenCalledWith({ search: { view: 'board' } })
  })

  it('subtitle is rendered', async () => {
    const mod = await import('../index')
    const ContactsPage = (
      mod.Route as unknown as { component: React.ComponentType }
    ).component
    render(<ContactsPage />, { wrapper: makeWrapper() })
    expect(
      screen.getByText(
        'Centralize e organize todos os seus leads em um só lugar',
      ),
    ).toBeInTheDocument()
  })
})

const STAGE_A = '00000000-0000-4000-8000-000000000001'
const STAGE_B = '00000000-0000-4000-8000-000000000002'

const stagesWithDataHandler = http.get('/api/pipeline/stages', () =>
  HttpResponse.json({
    stages: [
      {
        id: STAGE_A,
        name: 'Stage A',
        order: 1,
        isDefaultEntry: true,
        color: '#22c55e',
        description: null,
      },
      {
        id: STAGE_B,
        name: 'Stage B',
        order: 2,
        isDefaultEntry: false,
        color: '#64748b',
        description: null,
      },
    ],
  }),
)

const stagesEmptyHandler = http.get('/api/pipeline/stages', () =>
  HttpResponse.json({ stages: [] }),
)

const customFieldsEmptyHandler = http.get('/api/pipeline/custom-fields', () =>
  HttpResponse.json({ fields: [] }),
)

describe('ContactsPage — Adicionar lead button', () => {
  beforeEach(() => {
    mockView = 'board'
    mockNavigate.mockClear()
  })

  it('clicking opens the modal with the first stage selected and submitting creates a lead', async () => {
    let postCalled = false
    let postBody: { stageId?: string } | null = null
    overrideHandler(
      stagesWithDataHandler,
      customFieldsEmptyHandler,
      http.post('/api/pipeline/leads', async ({ request }) => {
        postCalled = true
        postBody = (await request.json()) as { stageId?: string }
        return HttpResponse.json(
          {
            lead: {
              id: '00000000-0000-4000-8000-000000000099',
              displayName: null,
              phoneNumber: 'manual:test',
              stageId: STAGE_A,
              position: 1024,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              customValues: null,
            },
          },
          { status: 201 },
        )
      }),
    )

    const mod = await import('../index')
    const ContactsPage = (
      mod.Route as unknown as { component: React.ComponentType }
    ).component
    render(<ContactsPage />, { wrapper: makeWrapper() })

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Adicionar lead/i }),
      ).not.toBeDisabled(),
    )

    fireEvent.click(screen.getByRole('button', { name: /Adicionar lead/i }))

    await screen.findByText('Novo Lead')
    const stageSelect = screen.getByRole('combobox', { name: /Etapa/i })
    expect((stageSelect as HTMLSelectElement).value).toBe(STAGE_A)

    fireEvent.click(screen.getByRole('button', { name: /Criar/i }))

    await waitFor(() => expect(postCalled).toBe(true))
    expect(postBody?.stageId).toBe(STAGE_A)
    await waitFor(() =>
      expect(screen.queryByText('Novo Lead')).not.toBeInTheDocument(),
    )
  })

  it('is disabled when there are no stages and clicking does not open the modal', async () => {
    overrideHandler(stagesEmptyHandler, customFieldsEmptyHandler)

    const mod = await import('../index')
    const ContactsPage = (
      mod.Route as unknown as { component: React.ComponentType }
    ).component
    render(<ContactsPage />, { wrapper: makeWrapper() })

    const button = await screen.findByRole('button', {
      name: /Adicionar lead/i,
    })
    await waitFor(() =>
      expect(button.getAttribute('aria-disabled')).toBe('true'),
    )
    expect(button).toBeDisabled()

    const wrapper = button.closest('span')
    expect(wrapper).toHaveAttribute(
      'data-tip',
      'Crie uma etapa antes de adicionar leads',
    )

    fireEvent.click(button)
    expect(screen.queryByText('Novo Lead')).not.toBeInTheDocument()
  })
})
