'use client';
import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { QuoteStageId } from '@repo/schemas';
import type { PipelineColumnKey, QuoteBoard, QuoteCard as QuoteCardType } from '../../types';
import { PipelineColumn } from './PipelineColumn';
import { QuoteCardPreview } from './QuoteCardPreview';

interface PipelineBoardDesktopProps {
  data: QuoteBoard;
  columns: PipelineColumnKey[];
  highlightedId?: string;
  onMove: (id: string, from: QuoteStageId, to: QuoteStageId, isDraft: boolean) => void;
}

export function PipelineBoardDesktop({
  data,
  columns,
  highlightedId,
  onMove,
}: PipelineBoardDesktopProps) {
  const [activeCard, setActiveCard] = useState<QuoteCardType | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragStart = ({ active }: DragStartEvent) => {
    const dragged = active.data.current as { card: QuoteCardType } | undefined;
    setActiveCard(dragged?.card ?? null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveCard(null);
    if (!over) return;
    const dragged = active.data.current as { card: QuoteCardType } | undefined;
    if (!dragged) return;
    const toStage = over.id as QuoteStageId;
    const fromStage = dragged.card.stageId as QuoteStageId;
    if (fromStage === toStage) return;
    onMove(dragged.card.id, fromStage, toStage, dragged.card.isDraft);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveCard(null)}
    >
      <div
        className={`grid h-full auto-rows-fr grid-cols-1 gap-4 ${
          columns.length > 4 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
        }`}
      >
        {columns.map((column) => (
          <PipelineColumn
            key={column}
            column={column}
            cards={data[column]}
            highlightedId={highlightedId}
          />
        ))}
      </div>
      <DragOverlay>{activeCard ? <QuoteCardPreview card={activeCard} /> : null}</DragOverlay>
    </DndContext>
  );
}
