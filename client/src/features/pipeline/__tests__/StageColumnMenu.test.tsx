import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StageColumnMenu } from '../StageColumnMenu'
import type { PipelineStage } from '@shared/pipeline'

const mockUpdateStage = { mutate: vi.fn(), isPending: false }
const mockDeleteStage = { mutate: vi.fn(), isPending: false }

vi.mock('../api', () => ({
  useStageMutations: () => ({
    updateStage: mockUpdateStage,
    deleteStage: mockDeleteStage,
  }),
}))

const stage: PipelineStage = {
  id: 'stage-1',
  name: 'Novo',
  order: 1,
  isDefaultEntry: true,
  color: '#22c55e',
  description: null,
}

const stages: PipelineStage[] = [stage]

function renderMenu(onRename = vi.fn()) {
  return render(
    <StageColumnMenu stage={stage} stages={stages} onRename={onRename} />,
  )
}

function openMenu() {
  fireEvent.click(screen.getByLabelText('Opções de Novo'))
}

function openColorPicker() {
  openMenu()
  fireEvent.click(screen.getByText('Alterar cor'))
}

describe('StageColumnMenu — color picker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('outside click while picker open does NOT close the picker', () => {
    renderMenu()
    openColorPicker()

    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeInTheDocument()
  })

  it('Aplicar closes the picker and triggers the stage mutation', () => {
    renderMenu()
    openColorPicker()

    fireEvent.click(screen.getByLabelText('Selecionar cor #ef4444'))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect(mockUpdateStage.mutate).toHaveBeenCalledTimes(1)
    expect(mockUpdateStage.mutate).toHaveBeenCalledWith({
      stageId: 'stage-1',
      body: { color: '#ef4444' },
    })
    expect(
      screen.queryByRole('button', { name: 'Aplicar' }),
    ).not.toBeInTheDocument()
  })

  it('Cancelar closes the picker without mutation, menu stays open', () => {
    renderMenu()
    openColorPicker()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(mockUpdateStage.mutate).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('button', { name: 'Aplicar' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Alterar cor')).toBeInTheDocument()
  })

  it('Escape while picker open closes picker, menu stays open', () => {
    renderMenu()
    openColorPicker()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(
      screen.queryByRole('button', { name: 'Aplicar' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Alterar cor')).toBeInTheDocument()
    expect(mockUpdateStage.mutate).not.toHaveBeenCalled()
  })
})
