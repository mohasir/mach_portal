'use client';
import { useRouter } from 'next/navigation';
import { Card, Dropdown, Tag, Typography, type MenuProps } from 'antd';
import { useDraggable } from '@dnd-kit/core';
import { MoveRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QUOTE_STAGE_TRANSITIONS, type QuoteStage } from '@repo/schemas';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { QUOTE_STAGE_COLORS } from '../../helpers';
import type { QuoteCard as QuoteCardType } from '../../types';

interface QuoteCardProps {
  card: QuoteCardType;
  draggable?: boolean;
  onMove: (id: string, from: QuoteStage, to: QuoteStage) => void;
}

export function QuoteCard({ card, draggable, onMove }: QuoteCardProps) {
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { card },
    disabled: !draggable,
  });

  const isExpired =
    card.stage === 'quoted' &&
    !!card.validUntil &&
    card.validUntil < new Date().toISOString().slice(0, 10);

  const moveOptions = QUOTE_STAGE_TRANSITIONS[card.stage];
  const items: MenuProps['items'] = moveOptions.map((to) => ({
    key: to,
    label: t(`stage.${to}`),
    onClick: (info) => {
      // AntD's Dropdown menu renders in a portal, so React's synthetic bubbling still
      // reaches the Card's onClick through the component tree — stop it explicitly or
      // picking a stage here also navigates to the quote.
      info.domEvent.stopPropagation();
      onMove(card.id, card.stage, to);
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
        <Typography.Text strong className="text-xs">
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
