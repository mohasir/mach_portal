'use client';
import { Divider, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { QuoteStageId } from '@repo/schemas';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useQuoteStages } from '@/features/settings';
import type { QuoteDetail } from '../../types';

interface QuoteHistoryCardProps {
  createdByName: QuoteDetail['createdByName'];
  createdAt: QuoteDetail['createdAt'];
  stageHistory: QuoteDetail['stageHistory'];
}

export function QuoteHistoryCard({ createdByName, createdAt, stageHistory }: QuoteHistoryCardProps) {
  const { t } = useTranslation('quotes');
  const { dateTime } = useDateFormatter();
  const { stageMap } = useQuoteStages();
  const unknownUser = t('history.unknownUser');
  const label = (stageId: QuoteStageId) => stageMap.get(stageId)?.label ?? stageId;

  return (
    <div>
      <Typography.Title level={5} className="font-heading text-brown m-0!">
        {t('history.title')}
      </Typography.Title>
      <Divider className="mt-3 mb-3" />
      <div className="flex flex-col gap-2 text-sm text-gray-500">
        <div>{t('history.createdBy', { name: createdByName ?? unknownUser, date: dateTime(createdAt) })}</div>
        {stageHistory
          .filter((h) => h.fromStageId !== null)
          .map((h, index) => (
            <div key={index}>
              {t('history.transition', {
                from: label(h.fromStageId as QuoteStageId),
                to: label(h.toStageId as QuoteStageId),
                name: h.changedByName ?? unknownUser,
                date: dateTime(h.changedAt),
              })}
            </div>
          ))}
      </div>
    </div>
  );
}
