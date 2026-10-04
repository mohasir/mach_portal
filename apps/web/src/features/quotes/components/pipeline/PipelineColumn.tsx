'use client';
import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Empty, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { OverlayScrollbars } from 'overlayscrollbars';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { useQuoteStages } from '@/features/settings';
import { hexToRgba } from '@/lib/utils/color';
import { MB } from '@/theme/antd';
import type { PipelineColumnKey, QuoteCard as QuoteCardType } from '../../types';
import { usePipelineScrollStore } from '../../pipelineScroll.store';
import { QuoteCard } from './QuoteCard';

interface PipelineColumnProps {
  column: PipelineColumnKey;
  cards: QuoteCardType[];
  highlightedId?: string;
  draggable?: boolean;
}

export function PipelineColumn({
  column,
  cards,
  highlightedId,
  draggable = true,
}: PipelineColumnProps) {
  const { t } = useTranslation('quotes');
  const { stageMap } = useQuoteStages();
  const isArchived = column === 'archived';
  const stageInfo = isArchived ? undefined : stageMap.get(column);
  // Archived isn't a stage (no admin-defined label/color) and nothing can be dropped into it.
  const stage = isArchived ? { label: t('pipeline.archived'), color: MB.taupe } : stageInfo;
  const { setNodeRef, isOver } = useDroppable({
    id: column,
    disabled: !draggable || isArchived,
  });

  const scrollEvents = useMemo(
    () => ({
      initialized: (instance: OverlayScrollbars) => {
        const top = usePipelineScrollStore.getState().columnScrollTop[column];
        if (top) instance.elements().viewport.scrollTop = top;
      },
      scroll: (instance: OverlayScrollbars) => {
        usePipelineScrollStore
          .getState()
          .setColumnScrollTop(column, instance.elements().viewport.scrollTop);
      },
    }),
    [column],
  );

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
        events={scrollEvents}
        defer
      >
        <div className="flex flex-col gap-2">
          {cards.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} className="my-4" />
          ) : (
            cards.map((card) => (
              <QuoteCard
                key={card.id}
                card={card}
                draggable={draggable && !card.isArchived}
                highlighted={card.id === highlightedId}
              />
            ))
          )}
        </div>
      </OverlayScrollbarsComponent>
    </div>
  );
}
