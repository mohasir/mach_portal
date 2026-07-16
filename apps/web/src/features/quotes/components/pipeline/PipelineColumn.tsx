'use client';
import { useDroppable } from '@dnd-kit/core';
import { Empty, Typography } from 'antd';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import type { QuoteStageId } from '@repo/schemas';
import { useQuoteStages } from '@/features/settings';
import { hexToRgba } from '@/lib/utils/color';
import type { QuoteCard as QuoteCardType } from '../../types';
import { QuoteCard } from './QuoteCard';

interface PipelineColumnProps {
  stageId: QuoteStageId;
  cards: QuoteCardType[];
  onMove: (id: string, from: QuoteStageId, to: QuoteStageId) => void;
  draggable?: boolean;
}

export function PipelineColumn({ stageId, cards, onMove, draggable = true }: PipelineColumnProps) {
  const { stageMap } = useQuoteStages();
  const stage = stageMap.get(stageId);
  const { setNodeRef, isOver } = useDroppable({ id: stageId, disabled: !draggable });

  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      className={`flex h-full min-h-40 flex-col gap-2 rounded-t-lg ${isOver ? 'border' : ''}`}
      style={
        stage
          ? {
              backgroundColor: hexToRgba(stage.color, 0.08),
              ...(isOver ? { borderColor: stage.color } : null),
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2 pt-3 px-4 pb-0">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stage?.color }} />
        <Typography.Text strong className="text-xs tracking-wide text-gray-600 uppercase">
          {stage?.label}
        </Typography.Text>
        <span className="rounded-md bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-600">
          {cards.length}
        </span>
      </div>
      <OverlayScrollbarsComponent
        className="pipeline-column-scrollbar min-h-0 flex-1 p-2 pb-8"
        options={{
          overflow: { x: 'hidden' },
          scrollbars: { autoHide: 'leave', theme: 'os-theme-dark' },
        }}
        defer
      >
        <div className="flex flex-col gap-2">
          {cards.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} className="my-4" />
          ) : (
            cards.map((card) => (
              <QuoteCard key={card.id} card={card} draggable={draggable} onMove={onMove} />
            ))
          )}
        </div>
      </OverlayScrollbarsComponent>
    </div>
  );
}
