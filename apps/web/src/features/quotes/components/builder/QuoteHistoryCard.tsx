'use client';
import { Timeline, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { QUOTE_STAGE, type QuoteStageId } from '@repo/schemas';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useQuoteStages } from '@/features/settings';
import type { QuoteDetail } from '../../types';

interface QuoteHistoryCardProps {
  createdByName: QuoteDetail['createdByName'];
  createdAt: QuoteDetail['createdAt'];
  stageHistory: QuoteDetail['stageHistory'];
}

export function QuoteHistoryCard({
  createdByName,
  createdAt,
  stageHistory,
}: QuoteHistoryCardProps) {
  const { t } = useTranslation('quotes');
  const { dateTime } = useDateFormatter();
  const { stageMap } = useQuoteStages();
  const unknownUser = t('history.unknownUser');
  const label = (stageId: QuoteStageId) => stageMap.get(stageId)?.label ?? String(stageId);

  const events = [
    {
      key: 'created',
      date: createdAt,
      color: stageMap.get(QUOTE_STAGE.PENDING)?.color,
      content: (
        <>
          <strong>{createdByName ?? unknownUser}</strong> {t('history.createdSuffix')}
        </>
      ),
    },
    ...stageHistory
      .filter((h) => h.fromStageId !== null)
      .map((h, index) => ({
        key: `transition-${index}`,
        date: h.changedAt,
        color: stageMap.get(h.toStageId as QuoteStageId)?.color,
        content: (
          <>
            <strong>{h.changedByName ?? unknownUser}</strong> {t('history.movedTo')}{' '}
            <strong>{label(h.toStageId as QuoteStageId)}</strong>
          </>
        ),
      })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div>
      <Typography.Title level={5} className="font-heading text-brown m-0!">
        {t('history.title')}
      </Typography.Title>
      <Timeline
        className="mt-4"
        items={events.map((event) => ({
          key: event.key,
          color: event.color ?? 'gray',
          content: (
            <div className="flex flex-col gap-0.5 text-base">
              <span>{event.content}</span>
              <span className="text-xs text-gray-500">{dateTime(event.date)}</span>
            </div>
          ),
        }))}
      />
    </div>
  );
}
