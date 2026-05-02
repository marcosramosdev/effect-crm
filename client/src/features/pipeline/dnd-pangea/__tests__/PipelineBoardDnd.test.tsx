import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { PipelineBoardDnd } from '../PipelineBoardDnd'
import type { PipelineLead, PipelineStage } from '@shared/pipeline'
import type {
  DropResult,
  DroppableProvided,
  DroppableStateSnapshot,
  DraggableProvided,
  DraggableStateSnapshot,
  DraggableRubric,
} from '@hello-pangea/dnd'

// Capture onDragEnd from DragDropContext so tests can trigger drops directly
const mockDnd = vi.hoisted(() => {
  let handler: ((result: DropResult) => void) | null = null
  return {
    setHandler: (fn: (result: DropResult) => void) => {
      handler = fn
    },
    trigger: (result: DropResult) => {
      if (!handler) throw new Error('DragDropContext not rendered yet')
      handler(result)
    },
  }
})

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode
    onDragEnd: (result: DropResult) => void
  }) => {
    mockDnd.setHandler(onDragEnd)
    return <div data-testid="dnd-context">{children}</div>
  },
  Droppable: ({
    children,
    droppableId,
  }: {
    children: (
      provided: DroppableProvided,
      snapshot: DroppableStateSnapshot,
    ) => ReactNode
    droppableId: string
  }) =>
    children(
      {
        innerRef: () => {},
        droppableProps: {
          'data-rfd-droppable-context-id': '1',
          'data-rfd-droppable-id': droppableId,
        },
        placeholder: <div data-testid={`placeholder-${droppableId}`} />,
      },
      {
        isDraggingOver: false,
        draggingOverWith: null,
        draggingFromThisWith: null,
        isUsingPlaceholder: false,
      },
    ),
  Draggable: ({
    children,
    draggableId,
    index,
  }: {
    children: (
      provided: DraggableProvided,
      snapshot: DraggableStateSnapshot,
      rubric: DraggableRubric,
    ) => ReactNode
    draggableId: string
    index: number
  }) =>
    children(
      {
        innerRef: () => {},
        draggableProps: {
          'data-rfd-draggable-context-id': '1',
          'data-rfd-draggable-id': draggableId,
        },
        dragHandleProps: {
          'data-rfd-drag-handle-draggable-id': draggableId,
          'data-rfd-drag-handle-context-id': '1',
          role: 'button',
          'aria-describedby': `rfd-hidden-text-1-${draggableId}`,
          tabIndex: 0,
          draggable: false,
          onDragStart: () => {},
        },
      },
      {
        isDragging: false,
        isDropAnimating: false,
        isClone: false,
        dropAnimation: null,
        draggingOver: null,
        combineWith: null,
        combineTargetFor: null,
        mode: null,
      },
      {
        draggableId,
        type: 'DEFAULT',
        source: { droppableId: 'stage-a', index },
      },
    ),
}))

// ─── Test data ───────────────────────────────────────────────────────────────

const STAGE_A_ID = 'stage-a'
const STAGE_B_ID = 'stage-b'
const LEAD_1 = 'lead-1'
const LEAD_2 = 'lead-2'
const LEAD_3 = 'lead-3'

const stages: PipelineStage[] = [
  {
    id: STAGE_A_ID,
    name: 'Stage A',
    order: 1,
    isDefaultEntry: true,
    color: '#22c55e',
    description: null,
  },
  {
    id: STAGE_B_ID,
    name: 'Stage B',
    order: 2,
    isDefaultEntry: false,
    color: '#3b82f6',
    description: null,
  },
]

// Three leads all in Stage A; Stage B is empty
const leads: PipelineLead[] = [
  {
    id: LEAD_1,
    displayName: 'Lead 1',
    phoneNumber: '+1111111111',
    stageId: STAGE_A_ID,
    position: 1024,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    customValues: null,
  },
  {
    id: LEAD_2,
    displayName: 'Lead 2',
    phoneNumber: '+2222222222',
    stageId: STAGE_A_ID,
    position: 2048,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    customValues: null,
  },
  {
    id: LEAD_3,
    displayName: 'Lead 3',
    phoneNumber: '+3333333333',
    stageId: STAGE_A_ID,
    position: 3072,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    customValues: null,
  },
]

function makeDropResult(
  draggableId: string,
  sourceDroppableId: string,
  sourceIndex: number,
  destDroppableId: string | null,
  destIndex: number | null,
): DropResult {
  return {
    draggableId,
    type: 'DEFAULT',
    mode: 'FLUID',
    reason: destDroppableId ? 'DROP' : 'CANCEL',
    source: { droppableId: sourceDroppableId, index: sourceIndex },
    destination:
      destDroppableId !== null && destIndex !== null
        ? { droppableId: destDroppableId, index: destIndex }
        : null,
    combine: null,
  }
}

function renderBoard(onMove: ReturnType<typeof vi.fn>) {
  return render(
    <PipelineBoardDnd
      stages={stages}
      leads={leads}
      onMove={onMove}
      renderColumnHeader={(stage) => (
        <div data-testid={`header-${stage.id}`}>{stage.name}</div>
      )}
      renderCard={(lead, provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...(provided.dragHandleProps ?? {})}
          data-testid={`card-${lead.id}`}
        >
          {lead.displayName}
        </div>
      )}
    />,
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PipelineBoardDnd', () => {
  let onMove: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onMove = vi.fn()
  })

  it('renders columns and cards', () => {
    renderBoard(onMove)

    expect(screen.getByTestId('header-stage-a')).toBeInTheDocument()
    expect(screen.getByTestId('header-stage-b')).toBeInTheDocument()
    expect(screen.getByTestId('card-lead-1')).toBeInTheDocument()
    expect(screen.getByTestId('card-lead-2')).toBeInTheDocument()
    expect(screen.getByTestId('card-lead-3')).toBeInTheDocument()
  })

  it('empty-column drop → position 1024', () => {
    // Stage B is empty; dropping lead-1 there should yield position 1024
    renderBoard(onMove)
    mockDnd.trigger(makeDropResult(LEAD_1, STAGE_A_ID, 0, STAGE_B_ID, 0))
    expect(onMove).toHaveBeenCalledOnce()
    expect(onMove).toHaveBeenCalledWith(LEAD_1, STAGE_B_ID, 1024)
  })

  it('append-end drop → max + 1024', () => {
    // Drag lead-1 to after lead-3 (last) in Stage A
    // destLeads (excluding lead-1) = [lead-2 (2048), lead-3 (3072)]
    // destIndex = 2 (past the last) → 3072 + 1024 = 4096
    renderBoard(onMove)
    mockDnd.trigger(makeDropResult(LEAD_1, STAGE_A_ID, 0, STAGE_A_ID, 2))
    expect(onMove).toHaveBeenCalledOnce()
    expect(onMove).toHaveBeenCalledWith(LEAD_1, STAGE_A_ID, 4096)
  })

  it('between-cards drop → midpoint', () => {
    // Drag lead-1 between lead-2 and lead-3 in Stage A
    // destLeads (excluding lead-1) = [lead-2 (2048), lead-3 (3072)]
    // destIndex = 1 → rightPos=3072, leftPos=2048 → floor((2048+3072)/2) = 2560
    renderBoard(onMove)
    mockDnd.trigger(makeDropResult(LEAD_1, STAGE_A_ID, 0, STAGE_A_ID, 1))
    expect(onMove).toHaveBeenCalledOnce()
    expect(onMove).toHaveBeenCalledWith(LEAD_1, STAGE_A_ID, 2560)
  })

  it('same-source-drop (same droppable + same index) → no-op', () => {
    renderBoard(onMove)
    mockDnd.trigger(makeDropResult(LEAD_1, STAGE_A_ID, 0, STAGE_A_ID, 0))
    expect(onMove).not.toHaveBeenCalled()
  })

  it('drop outside board (null destination) → no-op', () => {
    renderBoard(onMove)
    mockDnd.trigger(makeDropResult(LEAD_1, STAGE_A_ID, 0, null, null))
    expect(onMove).not.toHaveBeenCalled()
  })
})
