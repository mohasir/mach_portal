'use client';
import { useDroppable } from '@dnd-kit/core';
import { Badge, Empty, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { QuoteStage } from '@repo/schemas';
import { QUOTE_STAGE_COLORS } from '../../helpers';
import type { QuoteCard as QuoteCardType } from '../../types';
import { QuoteCard } from './QuoteCard';

interface PipelineColumnProps {
  stage: QuoteStage;
  cards: QuoteCardType[];
  onMove: (id: string, from: QuoteStage, to: QuoteStage) => void;
  draggable?: boolean;
}

export function PipelineColumn({ stage, cards, onMove, draggable = true }: PipelineColumnProps) {
  const { t } = useTranslation('quotes');
  const { setNodeRef, isOver } = useDroppable({ id: stage, disabled: !draggable });

  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      className={`flex min-h-40 flex-col gap-2 rounded-lg border p-2 ${
        isOver ? 'border-brand bg-brand/5' : 'border-line'
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <Typography.Text strong>{t(`stage.${stage}`)}</Typography.Text>
        <Badge count={cards.length} color={QUOTE_STAGE_COLORS[stage]} showZero />
      </div>
      {cards.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} className="my-4" />
      ) : (
        cards.map((card) => (
          <QuoteCard key={card.id} card={card} draggable={draggable} onMove={onMove} />
        ))
      )}
    </div>
  );
}
