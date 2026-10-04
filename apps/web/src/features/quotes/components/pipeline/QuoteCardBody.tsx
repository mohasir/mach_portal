'use client';
import { Tag, Typography } from 'antd';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconTag } from '@/components/shared/IconTag';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { isQuoteExpired, isQuotePastDue } from '../../helpers';
import type { QuoteCard as QuoteCardType } from '../../types';
import { CopyableQuoteNumber } from '../CopyableQuoteNumber';

interface QuoteCardBodyProps {
  card: QuoteCardType;
}

export function QuoteCardBody({ card }: QuoteCardBodyProps) {
  const { t } = useTranslation('quotes');
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();

  const isExpired = isQuoteExpired(card);
  const isPastDue = isQuotePastDue(card);
  const hasTags = card.isArchived || card.isDraft || isExpired || isPastDue;

  return (
    <>
      {hasTags && (
        <div className="mb-1 flex flex-wrap items-center gap-1">
          {card.isArchived && <Tag>{t('pipeline.archivedTag')}</Tag>}
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
      )}
      <Typography.Text strong className="text-xs">
        <CopyableQuoteNumber number={card.number} />
      </Typography.Text>
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
