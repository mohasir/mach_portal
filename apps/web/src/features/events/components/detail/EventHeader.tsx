'use client';
import { useRouter } from 'next/navigation';
import { Alert, App, Button, Card, Space, Tag, Typography } from 'antd';
import { CheckCircle, ExternalLink, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCancelQuote } from '@/features/quotes';
import { isPastDate } from '@/lib/date';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { EVENT_STATUS_COLORS } from '../../helpers';
import { useMarkEventCompleted } from '../../hooks/useEventPayments';
import type { EventDetail } from '../../types';

interface EventHeaderProps {
  event: EventDetail;
}

export function EventHeader({ event }: EventHeaderProps) {
  const { t } = useTranslation('events');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const { modal } = App.useApp();
  const { date } = useDateFormatter();
  const { markCompleted, isPending: isCompleting } = useMarkEventCompleted();
  const { cancelQuote, isPending: isCancelling } = useCancelQuote();

  const isUpcoming = event.status === 'upcoming';
  const isPastDue = isUpcoming && isPastDate(event.eventDate);

  const onMarkCompleted = () => {
    modal.confirm({
      title: t('detail.markCompletedConfirm.title'),
      content: t('detail.markCompletedConfirm.content'),
      okText: t('detail.markCompletedConfirm.ok'),
      onOk: () => markCompleted(event.id),
    });
  };

  const onCancel = () => {
    modal.confirm({
      title: t('detail.cancelConfirm.title'),
      content: t('detail.cancelConfirm.content'),
      okText: t('detail.cancelConfirm.ok'),
      okButtonProps: { danger: true },
      onOk: () => cancelQuote(event.quoteId),
    });
  };

  return (
    <Card size="small">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Typography.Title level={4} className="m-0">
              {event.quoteNumber}
            </Typography.Title>
            <Tag color={EVENT_STATUS_COLORS[event.status]}>{t(`status.${event.status}`)}</Tag>
            {event.eventTypeName && <Tag>{event.eventTypeName}</Tag>}
          </div>
          <div className="mt-1 text-sm text-gray-500">
            {event.eventDate ? date(event.eventDate) : '—'}
            {event.eventTime ? ` · ${event.eventTime}` : ''}
          </div>
          {event.address && (
            <div className="mt-1 text-sm text-gray-500">
              {event.address}
              {event.state ? `, ${event.state}` : ''}
            </div>
          )}
        </div>

        <Space wrap>
          <Button
            icon={<ExternalLink size={14} />}
            onClick={() => router.push(`/admin/quotes/${event.quoteId}`)}
          >
            {t('detail.backToQuote')}
          </Button>
          {isUpcoming && (
            <>
              <Button
                icon={<CheckCircle size={14} />}
                loading={isCompleting}
                onClick={onMarkCompleted}
              >
                {t('detail.markCompleted')}
              </Button>
              <Button danger icon={<XCircle size={14} />} loading={isCancelling} onClick={onCancel}>
                {t('detail.cancel')}
              </Button>
            </>
          )}
        </Space>
      </div>

      {isPastDue && (
        <Alert
          className="mt-3"
          type="warning"
          showIcon
          title={t('detail.pastDue')}
          action={
            <Button size="small" loading={isCompleting} onClick={onMarkCompleted}>
              {tc('yes')}
            </Button>
          }
        />
      )}
    </Card>
  );
}
