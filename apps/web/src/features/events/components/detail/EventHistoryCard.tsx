'use client';
import { Empty, Timeline } from 'antd';
import { useTranslation } from 'react-i18next';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import type { EventDetail } from '../../types';

type EventHistoryList = NonNullable<EventDetail['history']>;
type EventHistoryEntry = EventHistoryList[number];
type ScheduleSnapshot = { date: string | null; time: string | null };

interface EventHistoryCardProps {
  history: EventHistoryList;
}

export function EventHistoryCard({ history }: EventHistoryCardProps) {
  const { t } = useTranslation('events');
  const { date, dateTime, time } = useDateFormatter();
  const { money } = useMoneyFormatter();
  const unknownUser = t('detail.history.unknownUser');

  const schedule = (dateValue: string | null, timeValue: string | null) =>
    `${dateValue ? date(dateValue) : '—'}${timeValue ? ` · ${time(timeValue)}` : ''}`;

  const describe = (entry: EventHistoryEntry): string => {
    const data = (entry.data ?? {}) as Record<string, unknown>;
    switch (entry.type) {
      case 'staff_assigned':
        return t('detail.history.staffAssigned', { staffName: data.staffName ?? '—' });
      case 'staff_removed':
        return t('detail.history.staffRemoved', { staffName: data.staffName ?? '—' });
      case 'selections_updated':
        return t('detail.history.selectionsUpdated');
      case 'payment_registered':
        return t('detail.history.paymentRegistered', { amount: money(Number(data.amount) || 0) });
      case 'payment_removed':
        return t('detail.history.paymentRemoved', { amount: money(Number(data.amount) || 0) });
      case 'completed':
        return t('detail.history.completed');
      case 'rescheduled': {
        const to = data.to as ScheduleSnapshot | undefined;
        return t('detail.history.rescheduled', {
          to: to ? schedule(to.date, to.time) : '—',
          reason: data.reasonName ?? '—',
        });
      }
      default:
        return entry.type;
    }
  };

  if (history.length === 0) {
    return (
      <WrapperCard title={t('detail.history.title')}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('detail.history.empty')} />
      </WrapperCard>
    );
  }

  return (
    <WrapperCard title={t('detail.history.title')}>
      <Timeline
        className="mt-4"
        items={history.map((entry) => ({
          key: entry.id,
          color: 'gray',
          content: (
            <div className="flex flex-col gap-0.5 text-base">
              <span className="text-sm">
                <strong>{entry.changedByName ?? unknownUser}</strong> {describe(entry)}
              </span>
              <span className="text-xs text-gray-500">{dateTime(entry.changedAt)}</span>
            </div>
          ),
        }))}
      />
    </WrapperCard>
  );
}
