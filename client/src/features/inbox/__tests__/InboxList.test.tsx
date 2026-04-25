import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { overrideHandler } from '../../../test/msw/server'
import { InboxList } from '../InboxList'

const realtimeState = vi.hoisted(() => ({
  callbacks: [] as Array<(payload: { new: Record<string, unknown> }) => void>,
}))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: null }, error: null }),
      signOut: vi.fn(),
    },
    channel: () => ({
      on: (
        _event: string,
        _filter: unknown,
        cb: (payload: { new: Record<string, unknown> }) => void,
      ) => {
        realtimeState.callbacks.push(cb)
        return { subscribe: vi.fn() }
      },
    }),
    removeChannel: vi.fn(),
  },
}))

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

const OLDER = '2024-01-01T10:00:00.000Z'
const NEWER = '2024-01-01T11:00:00.000Z'
const TENANT_ID = '00000000-0000-0000-0000-000000000002'
const STAGE_ID = '00000000-0000-0000-0003-000000000001'

const conv1 = {
  id: '00000000-0000-0000-0001-000000000001',
  leadId: '00000000-0000-0000-0002-000000000001',
  leadDisplayName: 'Alice',
  leadPhoneNumber: '+351912345678',
  lastMessagePreview: 'Hello from Alice',
  lastMessageAt: NEWER,
  unreadCount: 2,
  stageId: STAGE_ID,
}

const conv2 = {
  id: '00000000-0000-0000-0001-000000000002',
  leadId: '00000000-0000-0000-0002-000000000002',
  leadDisplayName: 'Bob',
  leadPhoneNumber: '+351912345679',
  lastMessagePreview: 'Hello from Bob',
  lastMessageAt: OLDER,
  unreadCount: 0,
  stageId: STAGE_ID,
}

describe('InboxList', () => {
  beforeEach(() => {
    realtimeState.callbacks.length = 0
  })

  // T-C-020
  it('shows conversations ordered by lastMessageAt desc (most recent first)', async () => {
    overrideHandler(
      http.get('/api/inbox/conversations', () =>
        HttpResponse.json({
          conversations: [conv1, conv2],
          nextCursor: null,
        }),
      ),
    )

    render(<InboxList onSelect={vi.fn()} />, { wrapper: makeWrapper() })

    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Alice')
    expect(items[1]).toHaveTextContent('Bob')
  })

  // T-C-021
  it('click on conversation calls POST /read and zeroes unread badge', async () => {
    overrideHandler(
      http.get('/api/inbox/conversations', () =>
        HttpResponse.json({ conversations: [conv1, conv2], nextCursor: null }),
      ),
    )

    let readCalledForId: string | null = null
    overrideHandler(
      http.post('/api/inbox/conversations/:id/read', ({ params }) => {
        readCalledForId = params.id as string
        return HttpResponse.json({ conversationId: conv1.id, unreadCount: 0 })
      }),
    )

    const onSelect = vi.fn()
    render(<InboxList onSelect={onSelect} />, { wrapper: makeWrapper() })

    const firstItem = (await screen.findAllByRole('listitem'))[0]
    fireEvent.click(firstItem)

    await waitFor(() => expect(readCalledForId).toBe(conv1.id))
    await waitFor(() => expect(screen.queryByText('2')).not.toBeInTheDocument())
    expect(onSelect).toHaveBeenCalledWith(conv1.id)
  })

  // T-C-025
  it('new inbound message via Realtime appears at top of list in <200ms', async () => {
    overrideHandler(
      http.get('/api/inbox/conversations', () =>
        HttpResponse.json({
          conversations: [
            { ...conv2, lastMessageAt: NEWER },
            { ...conv1, lastMessageAt: OLDER },
          ],
          nextCursor: null,
        }),
      ),
    )

    render(<InboxList onSelect={vi.fn()} />, { wrapper: makeWrapper() })

    await screen.findAllByRole('listitem')
    const initialItems = screen.getAllByRole('listitem')
    expect(initialItems[0]).toHaveTextContent('Bob')
    expect(initialItems[1]).toHaveTextContent('Alice')

    await waitFor(() =>
      expect(realtimeState.callbacks.length).toBeGreaterThan(0),
    )

    const newTimestamp = new Date(Date.now() + 5000).toISOString()
    act(() => {
      realtimeState.callbacks[0]({
        new: {
          id: conv1.id,
          tenant_id: TENANT_ID,
          last_message_at: newTimestamp,
          unread_count: 1,
          last_message_preview: 'New message from Alice',
        },
      })
    })

    await waitFor(
      () => {
        const updatedItems = screen.getAllByRole('listitem')
        expect(updatedItems[0]).toHaveTextContent('Alice')
        expect(updatedItems[1]).toHaveTextContent('Bob')
      },
      { timeout: 200 },
    )
  })
})
