import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StageColorPicker } from '../StageColorPicker'

const PALETTE_FIRST = '#ef4444'
const PALETTE_SECOND = '#f97316'

describe('StageColorPicker', () => {
  it('renders 12 color swatches, Aplicar and Cancelar buttons', () => {
    render(
      <StageColorPicker
        initialColor="#64748b"
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getAllByRole('button', { name: /Selecionar cor/ })).toHaveLength(12)
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('palette click updates internal draft only — onApply not called', () => {
    const onApply = vi.fn()
    render(
      <StageColorPicker
        initialColor="#64748b"
        onApply={onApply}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByLabelText(`Selecionar cor ${PALETTE_FIRST}`))

    expect(onApply).not.toHaveBeenCalled()
  })

  it('Aplicar fires onApply with latest draft exactly once', () => {
    const onApply = vi.fn()
    render(
      <StageColorPicker
        initialColor="#64748b"
        onApply={onApply}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByLabelText(`Selecionar cor ${PALETTE_FIRST}`))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith(PALETTE_FIRST)
  })

  it('Cancelar fires onCancel and not onApply', () => {
    const onApply = vi.fn()
    const onCancel = vi.fn()
    render(
      <StageColorPicker
        initialColor="#64748b"
        onApply={onApply}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('multiple swatch clicks before Aplicar produce one onApply with final color', () => {
    const onApply = vi.fn()
    render(
      <StageColorPicker
        initialColor="#64748b"
        onApply={onApply}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByLabelText(`Selecionar cor ${PALETTE_FIRST}`))
    fireEvent.click(screen.getByLabelText(`Selecionar cor ${PALETTE_SECOND}`))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith(PALETTE_SECOND)
  })
})
