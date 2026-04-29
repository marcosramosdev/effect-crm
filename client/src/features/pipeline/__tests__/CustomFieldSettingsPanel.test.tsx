import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { overrideHandler } from '../../../test/msw/server'
import { CustomFieldSettingsPanel } from '../CustomFieldSettingsPanel'

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

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('CustomFieldSettingsPanel', () => {
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

  it('creates a new custom field', async () => {
    let createdBody: Record<string, unknown> | null = null

    overrideHandler(
      http.post('/api/pipeline/custom-fields', async ({ request }) => {
        createdBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          {
            field: {
              id: 'f-2',
              key: 'email',
              label: 'Email',
              type: 'text',
              order: 2,
            },
          },
          { status: 201 },
        )
      }),
    )

    render(<CustomFieldSettingsPanel />, { wrapper: makeWrapper() })
    await screen.findByText('Empresa')

    fireEvent.click(screen.getByRole('button', { name: /Adicionar/i }))
    fireEvent.change(screen.getByPlaceholderText('Chave (ex: company)'), {
      target: { value: 'email' },
    })
    fireEvent.change(screen.getByPlaceholderText('Etiqueta (ex: Empresa)'), {
      target: { value: 'Email' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Criar campo/i }))

    await waitFor(() => {
      expect(createdBody).toMatchObject({
        key: 'email',
        label: 'Email',
        type: 'text',
      })
    })
  })

  it('shows alert when 20-field limit is hit', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    overrideHandler(
      http.post('/api/pipeline/custom-fields', () =>
        HttpResponse.json(
          {
            error: { code: 'CUSTOM_FIELDS_LIMIT', message: 'Limite atingido' },
          },
          { status: 409 },
        ),
      ),
    )

    render(<CustomFieldSettingsPanel />, { wrapper: makeWrapper() })
    await screen.findByText('Empresa')

    fireEvent.click(screen.getByRole('button', { name: /Adicionar/i }))
    fireEvent.change(screen.getByPlaceholderText('Chave (ex: company)'), {
      target: { value: 'extra' },
    })
    fireEvent.change(screen.getByPlaceholderText('Etiqueta (ex: Empresa)'), {
      target: { value: 'Extra' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Criar campo/i }))

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Limite de 20 campos personalizados atingido.',
      )
    })

    alertSpy.mockRestore()
  })
})
