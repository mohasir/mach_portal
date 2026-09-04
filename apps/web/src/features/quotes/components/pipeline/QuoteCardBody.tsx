'use client';
import { Tag, Typography } from 'antd';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QUOTE_STAGE, type QuoteStageId } from '@repo/schemas';
import { IconTag } from '@/components/shared/IconTag';
import { isPastDate } from '@/lib/date';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import type { QuoteCard as QuoteCardType } from '../../types';
import { CopyableQuoteNumber } from '../CopyableQuoteNumber';

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
    (stageId === QUOTE_STAGE.PENDING || stageId === QUOTE_STAGE.QUOTED) &&
    isPastDate(card.eventDate);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Typography.Text strong className="text-xs">
          <CopyableQuoteNumber number={card.number} />
        </Typography.Text>
        <div className="flex items-center gap-1">
          {card.isDraft && (
            <IconTag
              color={card.isComplete ? undefined : 'error'}
              icon={card.isComplete ? undefined : AlertCircle}
            >
              {t('pipeline.draftTag')}
            </IconTag>
          )}
          {isExpired && <Tag color="red">{t('pipeline.expired')}</Tag>}
          {isPastDue && <Tag color="orange">{t('pipeline.pastDue')}</Tag>}
        </div>
      </div>
      <div className="mt-1 text-base font-medium">{card.clientName}</div>
      {card.eventTypeName && <div className="text-xs text-gray-500">{card.eventTypeName}</div>}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {card.eventDate ? date(card.eventDate) : t('pipeline.noDate')}
        </span>
        <span className="text-base font-semibold">{money(card.total)}</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {t('pipeline.linesCount', { count: card.linesCount })}
      </div>
    </>
  );
}
