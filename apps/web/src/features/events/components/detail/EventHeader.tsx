'use client';
import { useRouter } from 'next/navigation';
import { App, Button, Card, Space, Tag, Typography } from 'antd';
import { CheckCircle, ExternalLink, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AddressLines } from '@/components/shared/AddressLines';
import { useConfirmModal, useDeleteConfirm } from '@/components/shared/ConfirmDialogs';
import { WrapperAlert } from '@/components/shared/WrapperAlert';
import { useCancelQuote } from '@/features/quotes';
import { isPastDate } from '@/lib/date';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { EVENT_STATUS_COLORS } from '../../helpers';
import { useMarkEventCompleted } from '../../hooks/useEventPayments';
import type { EventDetail } from '../../types';

interface EventHeaderProps {
  event: EventDetail;
}

export function EventHeader({ event }: EventHeaderProps) {
  const { t } = useTranslation('events');
  const router = useRouter();
  const { modal } = App.useApp();
  const isDesktop = useIsDesktop();
  const [confirmAction, actionContextHolder] = useConfirmModal();
  const [confirmDelete, deleteContextHolder] = useDeleteConfirm();
  const { date } = useDateFormatter();
  const { markCompleted, isPending: isCompleting } = useMarkEventCompleted();
  const { cancelQuote, isPending: isCancelling } = useCancelQuote();

  const isUpcoming = event.status === 'upcoming';
  const isPastDue = isUpcoming && isPastDate(event.eventDate);

  const onMarkCompleted = () => {
    const options = {
      title: t('detail.markCompletedConfirm.title'),
      content: t('detail.markCompletedConfirm.content'),
      okText: t('detail.markCompletedConfirm.ok'),
      onOk: () => markCompleted(event.id),
    };
    if (!isDesktop) return confirmAction(options);
    modal.confirm(options);
  };

  const onCancel = () => {
    const options = {
      title: t('detail.cancelConfirm.title'),
      content: t('detail.cancelConfirm.content'),
      okText: t('detail.cancelConfirm.ok'),
      onOk: () => cancelQuote(event.quoteId),
    };
    if (!isDesktop) return confirmDelete(options);
    modal.confirm({ ...options, okButtonProps: { danger: true } });
  };

  return (
    <div>
      <div className="mb-4">
        {isPastDue && (
          <WrapperAlert
            className="mt-2"
            type="info"
            icon="help"
            title={t('detail.pastDueTitle')}
            description={t('detail.pastDue')}
            actionText="Marcarlo"
            onAction={onMarkCompleted}
          />
        )}
        {event.selectionsPending && (
          <WrapperAlert
            className="mt-2"
            type="error"
            showIcon
            title={t('detail.selections.pendingAlert')}
            description={
              event.selectionsDeadline
                ? t('detail.selections.deadlineNote', { date: date(event.selectionsDeadline) })
                : undefined
            }
          />
        )}
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Typography.Title level={4} className="m-0">
                {event.quoteNumber}
              </Typography.Title>
              <Tag color={EVENT_STATUS_COLORS[event.status]}>{t(`status.${event.status}`)}</Tag>
              {event.eventTypeName && <Tag>{event.eventTypeName}</Tag>}
            </div>
            <div className="mt-1 text-base text-gray-500">
              {event.eventDate ? date(event.eventDate) : '—'}
              {event.eventTime ? ` · ${event.eventTime}` : ''}
            </div>
            <AddressLines
              address={event.address}
              city={event.city}
              state={event.state}
              className="mt-1 text-base text-gray-500"
            />
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
                <Button
                  danger
                  icon={<XCircle size={14} />}
                  loading={isCancelling}
                  onClick={onCancel}
                >
                  {t('detail.cancel')}
                </Button>
              </>
            )}
          </Space>
        </div>
      </Card>
      {actionContextHolder}
      {deleteContextHolder}
    </div>
  );
}
