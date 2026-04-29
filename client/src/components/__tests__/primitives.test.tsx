import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Card, CardHeader, CardBody, CardFooter } from '../Card'
import { FilterPills } from '../FilterPills'
import { MetricBadge } from '../MetricBadge'
import { PromoCard } from '../PromoCard'
import { EmptyState } from '../EmptyState'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>hello</Card>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('accepts custom className', () => {
    const { container } = render(<Card className="custom">x</Card>)
    expect(container.firstChild).toHaveClass('custom')
  })

  it('renders as a different element via as prop', () => {
    const { container } = render(<Card as="section">x</Card>)
    expect(container.querySelector('section')).toBeInTheDocument()
  })

  it('CardHeader renders children', () => {
    render(<CardHeader>head</CardHeader>)
    expect(screen.getByText('head')).toBeInTheDocument()
  })

  it('CardBody renders children', () => {
    render(<CardBody>body</CardBody>)
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('CardFooter renders children', () => {
    render(<CardFooter>foot</CardFooter>)
    expect(screen.getByText('foot')).toBeInTheDocument()
  })
})

describe('FilterPills', () => {
  const pills = [
    { label: 'Pending', count: 4 },
    { label: 'Assigned', count: 15, active: true },
    { label: 'Completed', count: 10 },
  ]

  it('renders all pills with counts', () => {
    render(<FilterPills pills={pills} />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Assigned')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('active pill has aria-pressed="true"', () => {
    render(<FilterPills pills={pills} />)
    const assignedBtn = screen.getByRole('button', { name: /Assigned/ })
    expect(assignedBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('inactive pills have aria-pressed="false"', () => {
    render(<FilterPills pills={pills} />)
    const pendingBtn = screen.getByRole('button', { name: /Pending/ })
    expect(pendingBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onSelect with the pill label when clicked', async () => {
    const onSelect = vi.fn()
    render(<FilterPills pills={pills} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /Pending/ }))
    expect(onSelect).toHaveBeenCalledWith('Pending')
  })
})

describe('MetricBadge', () => {
  it('renders count', () => {
    render(<MetricBadge count={7} />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('renders nothing when count is 0', () => {
    const { container } = render(<MetricBadge count={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('hides dot when dot=false', () => {
    const { container } = render(<MetricBadge count={3} dot={false} />)
    expect(container.querySelector('.rounded-full')).not.toBeInTheDocument()
  })
})

describe('PromoCard', () => {
  it('renders title, body, cta', () => {
    render(
      <PromoCard
        title="Unlock analytics"
        body="See advanced route data"
        ctaLabel="Get Premium"
      />,
    )
    expect(screen.getByText('Unlock analytics')).toBeInTheDocument()
    expect(screen.getByText('See advanced route data')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Get Premium' }),
    ).toBeInTheDocument()
  })

  it('calls onCta when button clicked', async () => {
    const onCta = vi.fn()
    render(<PromoCard title="T" body="B" ctaLabel="Go" onCta={onCta} />)
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onCta).toHaveBeenCalledTimes(1)
  })

  it('renders illustration slot when provided', () => {
    render(
      <PromoCard
        title="T"
        body="B"
        ctaLabel="Go"
        illustration={<span data-testid="illus" />}
      />,
    )
    expect(screen.getByTestId('illus')).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('renders heading', () => {
    render(<EmptyState heading="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('renders optional body text', () => {
    render(<EmptyState heading="H" body="Some description" />)
    expect(screen.getByText('Some description')).toBeInTheDocument()
  })

  it('renders optional action', () => {
    render(<EmptyState heading="H" action={<button>Create</button>} />)
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })

  it('renders without icon prop without crashing', () => {
    render(<EmptyState heading="No icon" />)
    expect(screen.getByText('No icon')).toBeInTheDocument()
  })
})
