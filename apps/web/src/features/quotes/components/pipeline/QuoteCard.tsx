'use client';
import { useRouter } from 'next/navigation';
import { Card, Dropdown, Tag, Typography, type MenuProps } from 'antd';
import { useDraggable } from '@dnd-kit/core';
import { MoveRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QUOTE_STAGE, QUOTE_STAGE_TRANSITIONS, type QuoteStageId } from '@repo/schemas';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { useQuoteStages } from '@/features/settings';
import type { QuoteCard as QuoteCardType } from '../../types';

interface QuoteCardProps {
  card: QuoteCardType;
  draggable?: boolean;
  onMove: (id: string, from: QuoteStageId, to: QuoteStageId) => void;
}

export function QuoteCard({ card, draggable, onMove }: QuoteCardProps) {
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();
  const { stageMap } = useQuoteStages();

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { card },
    disabled: !draggable,
  });

  const stageId = card.stageId as QuoteStageId;
  const stage = stageMap.get(stageId);
  const isExpired =
    stageId === QUOTE_STAGE.QUOTED &&
    !!card.validUntil &&
    card.validUntil < new Date().toISOString().slice(0, 10);

  const moveOptions = QUOTE_STAGE_TRANSITIONS[stageId];
  const items: MenuProps['items'] = moveOptions.map((to) => ({
    key: to,
    label: stageMap.get(to)?.label,
    onClick: (info) => {
      info.domEvent.stopPropagation();
      onMove(card.id, stageId, to);
    },
  }));

  const style = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px)`,
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  return (
    <Card
      ref={draggable ? setNodeRef : undefined}
      style={style}
      size="small"
      className={isDragging ? 'opacity-70 shadow-lg' : 'cursor-pointer'}
      onClick={() => router.push(`/admin/quotes/${card.id}`)}
      {...(draggable ? { ...attributes, ...listeners } : {})}
    >
      <div className="flex items-center justify-between gap-2">
        <Typography.Text strong className="text-xs" style={{ color: stage?.color }}>
          {card.number}
        </Typography.Text>
        {isExpired && <Tag color="red">{t('pipeline.expired')}</Tag>}
      </div>
      <div className="mt-1 text-sm font-medium">{card.clientName}</div>
      {card.eventTypeName && <div className="text-xs text-gray-500">{card.eventTypeName}</div>}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">{card.eventDate ? date(card.eventDate) : '—'}</span>
        <span className="text-sm font-semibold">{money(card.total)}</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {t('pipeline.linesCount', { count: card.linesCount })}
      </div>
      {!draggable && moveOptions.length > 0 && (
        <Dropdown menu={{ items }} trigger={['click']}>
          <div
            className="border-line mt-2 flex items-center justify-center gap-1 rounded border p-1.5 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <MoveRight size={14} /> {t('pipeline.moveTo')}
          </div>
        </Dropdown>
      )}
    </Card>
  );
}
