'use client';
import { Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { QUOTE_STAGE, type QuoteStageId } from '@repo/schemas';
import { isPastDate } from '@/lib/date';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import type { QuoteCard as QuoteCardType } from '../../types';

interface QuoteCardBodyProps {
  card: QuoteCardType;
}

export function QuoteCardBody({ card }: QuoteCardBodyProps) {
  const { t } = useTranslation('quotes');
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();

  const stageId = card.stageId as QuoteStageId;
  const isExpired = stageId === QUOTE_STAGE.QUOTED && isPastDate(card.validUntil);
  const isPastDue =
    (stageId === QUOTE_STAGE.PENDING || stageId === QUOTE_STAGE.QUOTED) && isPastDate(card.eventDate);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Typography.Text strong className="text-xs">
          {card.number}
        </Typography.Text>
        <div className="flex items-center gap-1">
          {card.isDraft && <Tag>{t('pipeline.draftTag')}</Tag>}
          {isExpired && <Tag color="red">{t('pipeline.expired')}</Tag>}
          {isPastDue && <Tag color="orange">{t('pipeline.pastDue')}</Tag>}
        </div>
      </div>
      <div className="mt-1 text-sm font-medium">{card.clientName}</div>
      {card.eventTypeName && <div className="text-xs text-gray-500">{card.eventTypeName}</div>}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {card.eventDate ? date(card.eventDate) : t('pipeline.noDate')}
        </span>
        <span className="text-sm font-semibold">{money(card.total)}</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {t('pipeline.linesCount', { count: card.linesCount })}
      </div>
    </>
  );
}
