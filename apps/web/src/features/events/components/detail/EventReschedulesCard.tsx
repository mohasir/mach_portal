'use client';
import { Timeline } from 'antd';
import { useTranslation } from 'react-i18next';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import type { EventDetail } from '../../types';

interface EventReschedulesCardProps {
  reschedules: NonNullable<EventDetail['reschedules']>;
}

export function EventReschedulesCard({ reschedules }: EventReschedulesCardProps) {
  const { t } = useTranslation('events');
  const { date, dateTime, time } = useDateFormatter();

  if (reschedules.length === 0) return null;

  const schedule = (dateValue: string | null, timeValue: string | null) =>
    `${dateValue ? date(dateValue) : '—'}${timeValue ? ` · ${time(timeValue)}` : ''}`;

  return (
    <WrapperCard title={t('detail.reschedules.title')}>
      <Timeline
        className="mt-4"
        items={reschedules.map((entry) => ({
          key: entry.id,
          color: 'blue',
          content: (
            <div className="flex flex-col gap-0.5 text-sm">
              <span>
                {`${schedule(entry.fromDate, entry.fromTime)} → `}
                <strong>{schedule(entry.toDate, entry.toTime)}</strong>
              </span>
              <span>
                {t('detail.reschedules.reason')}: {entry.reasonName}
              </span>
              {entry.note && <span className="text-gray-500">{entry.note}</span>}
              {entry.staffConflicts.length > 0 && (
                <span className="text-gray-500">
                  {t('detail.reschedules.staffConflicts', {
                    names: entry.staffConflicts.map((conflict) => conflict.name).join(', '),
                  })}
                </span>
              )}
              <span className="text-xs text-gray-500">
                {entry.rescheduledByName ?? t('detail.history.unknownUser')} ·{' '}
                {dateTime(entry.rescheduledAt)}
              </span>
            </div>
          ),
        }))}
      />
    </WrapperCard>
  );
}
