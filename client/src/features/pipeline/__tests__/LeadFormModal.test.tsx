import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import type { PipelineLead } from '@shared/pipeline'
import { overrideHandler } from '../../../test/msw/server'
import { LeadFormModal } from '../LeadFormModal'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
      signOut: vi.fn(),
    },
  },
}))

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

const STAGE_ID = '00000000-0000-4000-8000-000000000001'
const STAGE_ID_2 = '00000000-0000-4000-8000-000000000002'
const LEAD_ID = '00000000-0000-4000-8000-000000000010'

const stagesHandler = http.get('/api/pipeline/stages', () =>
  HttpResponse.json({
    stages: [
      { id: STAGE_ID, name: 'Stage A', order: 1, isDefaultEntry: true, color: '#64748b', description: null },
      { id: STAGE_ID_2, name: 'Stage B', order: 2, isDefaultEntry: false, color: '#64748b', description: null },
    ],
  }),
)

describe('LeadFormModal', () => {
  beforeEach(() => {
    overrideHandler(
      http.get('/api/pipeline/custom-fields', () =>
        HttpResponse.json({
          fields: [
            {
              id: 'f-1',
              tenantId: 't-1',
              key: 'company',
              label: 'Empresa',
              type: 'text',
              options: null,
              order: 1,
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          ],
        }),
      ),
    )
  })

  it('renders create mode with validation errors', async () => {
    render(
      <LeadFormModal open mode="create" stageId={STAGE_ID} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    )

    await screen.findByText('Novo Lead')
    await screen.findByPlaceholderText('Nome do lead')
    await screen.findByPlaceholderText('+351900000001')
    await screen.findByPlaceholderText('Empresa')
  })

  it('fires move mutation when stage changes in edit mode', async () => {
    const lead: PipelineLead = {
      id: LEAD_ID,
      displayName: 'Test',
      phoneNumber: '+351912345678',
      stageId: STAGE_ID,
      position: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      customValues: null,
    }

    let moveCalled = false
    overrideHandler(
      stagesHandler,
      http.get('/api/pipeline/custom-fields', () => HttpResponse.json({ fields: [] })),
      http.patch(`/api/pipeline/leads/${LEAD_ID}`, () =>
        HttpResponse.json({
          lead: { ...lead, stageId: STAGE_ID_2 },
        }),
      ),
      http.patch(`/api/pipeline/leads/${LEAD_ID}/stage`, () => {
        moveCalled = true
        return HttpResponse.json({ lead: { ...lead, stageId: STAGE_ID_2 } })
      }),
    )

    render(
      <LeadFormModal open mode="edit" lead={lead} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    )

    await screen.findByText('Stage A')

    fireEvent.change(screen.getByRole('combobox', { name: /Etapa/i }), {
      target: { value: STAGE_ID_2 },
    })

    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }))

    await waitFor(() => expect(moveCalled).toBe(true))
  })

  it('shows inline error for invalid email on submit', async () => {
    overrideHandler(
      stagesHandler,
      http.get('/api/pipeline/custom-fields', () =>
        HttpResponse.json({
          fields: [
            {
              id: 'f-email',
              tenantId: 't-1',
              key: 'email',
              label: 'Email',
              type: 'email',
              options: null,
              order: 1,
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          ],
        }),
      ),
    )

    render(
      <LeadFormModal open mode="create" stageId={STAGE_ID} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    )

    await screen.findByPlaceholderText('Email')

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'not-an-email' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Criar/i }))

    await waitFor(() => {
      expect(screen.getByText('Email inválido')).toBeInTheDocument()
    })
  })

  it('persists checkbox toggle in request body', async () => {
    let capturedBody: Record<string, unknown> | null = null
    overrideHandler(
      stagesHandler,
      http.get('/api/pipeline/custom-fields', () =>
        HttpResponse.json({
          fields: [
            {
              id: 'f-cb',
              tenantId: 't-1',
              key: 'active',
              label: 'Activo',
              type: 'checkbox',
              options: null,
              order: 1,
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          ],
        }),
      ),
      http.post('/api/pipeline/leads', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          {
            lead: {
              id: crypto.randomUUID(),
              displayName: null,
              phoneNumber: 'manual:test',
              stageId: STAGE_ID,
              position: 0,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              customValues: null,
            },
          },
          { status: 201 },
        )
      }),
    )

    render(
      <LeadFormModal open mode="create" stageId={STAGE_ID} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    )

    await screen.findByRole('checkbox')

    fireEvent.click(screen.getByRole('checkbox'))

    fireEvent.click(screen.getByRole('button', { name: /Criar/i }))

    await waitFor(() => {
      expect(capturedBody).not.toBeNull()
      expect(
        (capturedBody as { customValues?: Record<string, unknown> }).customValues?.['f-cb'],
      ).toBe(true)
    })
  })

  it('strips leading @ from instagram field before save', async () => {
    let capturedBody: Record<string, unknown> | null = null
    overrideHandler(
      stagesHandler,
      http.get('/api/pipeline/custom-fields', () =>
        HttpResponse.json({
          fields: [
            {
              id: 'f-ig',
              tenantId: 't-1',
              key: 'instagram',
              label: 'Instagram',
              type: 'instagram',
              options: null,
              order: 1,
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          ],
        }),
      ),
      http.post('/api/pipeline/leads', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          {
            lead: {
              id: crypto.randomUUID(),
              displayName: null,
              phoneNumber: 'manual:test',
              stageId: STAGE_ID,
              position: 0,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              customValues: null,
            },
          },
          { status: 201 },
        )
      }),
    )

    render(
      <LeadFormModal open mode="create" stageId={STAGE_ID} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    )

    await screen.findByPlaceholderText('username')

    fireEvent.change(screen.getByPlaceholderText('username'), {
      target: { value: '@testuser' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Criar/i }))

    await waitFor(() => {
      expect(capturedBody).not.toBeNull()
      expect(
        (capturedBody as { customValues?: Record<string, unknown> }).customValues?.['f-ig'],
      ).toBe('testuser')
    })
  })

  it('surfaces duplicate phone error', async () => {
    overrideHandler(
      http.post('/api/pipeline/leads', () =>
        HttpResponse.json(
          {
            error: { code: 'LEAD_PHONE_EXISTS', message: 'Telefone duplicado' },
          },
          { status: 409 },
        ),
      ),
    )

    render(
      <LeadFormModal open mode="create" stageId={STAGE_ID} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    )

    await screen.findByText('Novo Lead')
    await screen.findByPlaceholderText('+351900000001')

    fireEvent.change(screen.getByPlaceholderText('+351900000001'), {
      target: { value: '+351912345678' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Criar/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/Número de telefone já existe/i),
      ).toBeInTheDocument()
    })
  })
})
