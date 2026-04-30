import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StageColorPicker } from '../StageColorPicker'

describe('StageColorPicker', () => {
  it('renders 12 color swatches', () => {
    render(<StageColorPicker value="#64748b" onChange={vi.fn()} />)

    const buttons = screen.getAllByRole('button')
    // 12 palette buttons + 1 custom color toggle
    expect(buttons.length).toBe(13)
  })

  it('emits hex on palette click', () => {
    const onChange = vi.fn()
    render(<StageColorPicker value="#64748b" onChange={onChange} />)

    const firstSwatch = screen.getAllByRole('button')[0]
    fireEvent.click(firstSwatch)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0]).toMatch(/^#/)
  })
})
