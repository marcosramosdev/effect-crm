import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult, DraggableProvided } from '@hello-pangea/dnd'
import type { ReactNode } from 'react'
import type { PipelineLead, PipelineStage } from '@shared/pipeline'

export interface PipelineBoardDndProps {
  stages: PipelineStage[]
  leads: PipelineLead[]
  onMove: (leadId: string, targetStageId: string, position: number) => void
  renderColumnHeader: (
    stage: PipelineStage,
    stageLeads: PipelineLead[],
  ) => ReactNode
  renderCard: (
    lead: PipelineLead,
    provided: DraggableProvided,
    isDragging: boolean,
  ) => ReactNode
  renderEmptyColumn?: (stage: PipelineStage) => ReactNode
  renderColumnFooter?: (stage: PipelineStage) => ReactNode
  renderBoardFooter?: () => ReactNode
}

function computePosition(
  sortedLeads: PipelineLead[],
  destIndex: number,
): number {
  if (sortedLeads.length === 0) return 1024

  if (destIndex >= sortedLeads.length) {
    return (sortedLeads[sortedLeads.length - 1]?.position ?? 0) + 1024
  }

  const rightPos = sortedLeads[destIndex].position
  const leftPos = destIndex > 0 ? sortedLeads[destIndex - 1].position : 0

  return Math.floor((leftPos + rightPos) / 2)
}

export function PipelineBoardDnd({
  stages,
  leads,
  onMove,
  renderColumnHeader,
  renderCard,
  renderEmptyColumn,
  renderColumnFooter,
  renderBoardFooter,
}: PipelineBoardDndProps) {
  function handleDragEnd(result: DropResult) {
    const { draggableId, source, destination } = result

    if (!destination) return
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return
    }

    const targetStageId = destination.droppableId
    const destLeads = leads
      .filter((l) => l.stageId === targetStageId && l.id !== draggableId)
      .sort((a, b) => a.position - b.position)

    const position = computePosition(destLeads, destination.index)
    onMove(draggableId, targetStageId, position)
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="board-scroll flex gap-3 px-4 py-3 overflow-x-auto scroll-smooth [scroll-snap-type:x_proximity] [overscroll-behavior-x:contain] h-full bg-base-100">
        {stages.map((stage) => {
          const stageLeads = leads
            .filter((l) => l.stageId === stage.id)
            .sort((a, b) => a.position - b.position)

          return (
            <div
              key={stage.id}
              className="flex flex-col w-[300px] shrink-0 bg-base-200/40 rounded-xl min-h-full max-h-full [scroll-snap-align:start]"
            >
              {renderColumnHeader(stage, stageLeads)}

              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex flex-col gap-2 p-2 flex-1 overflow-y-auto min-h-16 transition-colors ${
                      snapshot.isDraggingOver
                        ? 'bg-primary/5 ring-1 ring-primary/30 ring-inset rounded-md'
                        : ''
                    }`}
                  >
                    {stageLeads.length === 0 && renderEmptyColumn?.(stage)}
                    {stageLeads.map((lead, index) => (
                      <Draggable
                        key={lead.id}
                        draggableId={lead.id}
                        index={index}
                        isDragDisabled={false}
                      >
                        {(draggableProvided, draggableSnapshot) =>
                          renderCard(
                            lead,
                            draggableProvided,
                            draggableSnapshot.isDragging,
                          )
                        }
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {renderColumnFooter?.(stage)}
            </div>
          )
        })}

        {renderBoardFooter?.()}
      </div>
    </DragDropContext>
  )
}
