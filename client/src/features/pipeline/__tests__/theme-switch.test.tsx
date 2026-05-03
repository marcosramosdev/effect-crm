import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { PipelineLead, PipelineStage } from '@shared/pipeline'
import { PipelineBoardDnd } from '../dnd-pangea/PipelineBoardDnd'
import { PipelineCard } from '../PipelineCard'

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
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
      { isDraggingOver: false },
    ),
  Draggable: ({
    children,
  }: {
    children: (p: object, s: object) => ReactNode
  }) =>
    children(
      { innerRef: () => {}, draggableProps: {}, dragHandleProps: {} },
      { isDragging: false },
    ),
}))

const stages: PipelineStage[] = [
  {
    id: 's1',
    name: 'Novo',
    order: 1,
    isDefaultEntry: true,
    color: '#22c55e',
    description: null,
  },
]

const leads: PipelineLead[] = [
  {
    id: 'l1',
    displayName: 'Test',
    phoneNumber: '+351900000001',
    stageId: 's1',
    position: 1024,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    customValues: null,
  },
]

const HEX_RE = /#[0-9a-fA-F]{3,8}/
const LITERAL_COLOR_CLASSES = [
  'bg-white',
  'bg-gray-',
  'text-gray-',
  'border-gray-',
  'bg-slate-',
]

function Board() {
  return (
    <PipelineBoardDnd
      stages={stages}
      leads={leads}
      onMove={() => {}}
      renderColumnHeader={(stage) => <div>{stage.name}</div>}
      renderCard={(lead, provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <PipelineCard lead={lead} stage={stages[0]} onClick={() => {}} />
        </div>
      )}
    />
  )
}

describe('theme switch smoke test', () => {
  it('renders identical DOM under light and dark themes', () => {
    document.documentElement.setAttribute('data-theme', 'light')
    const { container, rerender, unmount } = render(<Board />)
    const lightHtml = container.innerHTML

    document.documentElement.setAttribute('data-theme', 'dark')
    rerender(<Board />)
    const darkHtml = container.innerHTML

    expect(darkHtml).toBe(lightHtml)
    unmount()
  })

  it('no element holds a literal color class or non-stage-color hex in className', () => {
    document.documentElement.setAttribute('data-theme', 'light')
    const { container } = render(<Board />)
    const all = container.querySelectorAll<HTMLElement>('*')
    for (const el of all) {
      const cls = el.className
      const text = typeof cls === 'string' ? cls : ''
      for (const bad of LITERAL_COLOR_CLASSES) {
        expect(text).not.toContain(bad)
      }
      expect(HEX_RE.test(text)).toBe(false)
    }
  })
})
