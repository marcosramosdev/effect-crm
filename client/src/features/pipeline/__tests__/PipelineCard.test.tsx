import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { PipelineCard } from '../PipelineCard'

const STAGE_ID = '11111111-1111-4111-8111-111111111111'
const LEAD_ID = '22222222-2222-4222-8222-222222222222'

const stage = {
  id: STAGE_ID,
  name: 'Novo',
  order: 1,
  isDefaultEntry: true,
  color: '#22c55e',
  description: null,
}

const lead = {
  id: LEAD_ID,
  displayName: 'Alice Silva',
  phoneNumber: '+351912345678',
  stageId: STAGE_ID,
  position: 1024,
  createdAt: '2024-01-01T10:00:00.000Z',
  updatedAt: '2024-01-01T10:00:00.000Z',
  customValues: null,
}

describe('PipelineCard', () => {
  it('renders card with stage tag, title, and icons', () => {
    render(<PipelineCard lead={lead} stage={stage} onClick={() => {}} />)

    expect(screen.getByText('Alice Silva')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('click fires onClick', () => {
    const onClick = vi.fn()
    render(<PipelineCard lead={lead} stage={stage} onClick={onClick} />)

    fireEvent.click(screen.getByText('Alice Silva'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('small pointermove (3px) still fires onClick', () => {
    const onClick = vi.fn()
    render(<PipelineCard lead={lead} stage={stage} onClick={onClick} />)

    const card = screen.getByRole('button')
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0 })
    fireEvent.pointerMove(card, { clientX: 3, clientY: 0 })
    fireEvent.pointerUp(card)
    fireEvent.click(card)

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('large pointermove (20px) does NOT fire onClick', () => {
    const onClick = vi.fn()
    const { container } = render(
      <PipelineCard lead={lead} stage={stage} onClick={onClick} />,
    )

    const card = screen.getByRole('button')
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0 })
    fireEvent.pointerMove(card, { clientX: 20, clientY: 0 })
    fireEvent.pointerUp(card)

    expect(screen.getByText('Alice Silva')).toBeInTheDocument()
  })

  it('renders stage tag when stage is provided', () => {
    const { container } = render(
      <PipelineCard lead={lead} stage={stage} onClick={() => {}} />,
    )

    const stageBadge = container.querySelector('.badge-sm.gap-1')
    expect(stageBadge).toBeInTheDocument()
    expect(stageBadge).toHaveTextContent('Novo')
  })

  it('gracefully omits stage tag when stage is absent', () => {
    const { container } = render(
      <PipelineCard lead={lead} onClick={() => {}} />,
    )

    const stageBadge = container.querySelector('.badge-sm.gap-1')
    expect(stageBadge).not.toBeInTheDocument()
    expect(screen.getByText('Alice Silva')).toBeInTheDocument()
  })

  it('shows phone display when displayName is null', () => {
    const leadWithoutName = { ...lead, displayName: null }
    render(
      <PipelineCard lead={leadWithoutName} stage={stage} onClick={() => {}} />,
    )

    expect(screen.getByText('+351912345678')).toBeInTheDocument()
  })
})
