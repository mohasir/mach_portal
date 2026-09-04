'use client';
import { useRouter } from 'next/navigation';
import { App, Button, Card, Space, Tag, Typography } from 'antd';
import { CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AddressLines } from '@/components/shared/AddressLines';
import { useConfirmModal, useDeleteConfirm } from '@/components/shared/ConfirmDialogs';
import { QuoteNumberHeader } from '@/components/shared/QuoteNumberHeader';
import { WrapperAlert } from '@/components/shared/WrapperAlert';
import { useCancelQuote } from '@/features/quotes';
import { isPastDate } from '@/lib/date';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { copyToClipboard } from '@/lib/utils/clipboard';
import { EVENT_STATUS_COLORS } from '../../helpers';
import { useMarkEventCompleted } from '../../hooks/useEventPayments';
import type { EventDetail } from '../../types';

interface EventHeaderProps {
  event: EventDetail;
}

export function EventHeader({ event }: EventHeaderProps) {
  const { t } = useTranslation('events');
  const router = useRouter();
  const { modal, message } = App.useApp();
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

  const handleCopyNumber = async () => {
    const ok = await copyToClipboard(event.quoteNumber);
    if (ok) message.success(t('card.numberCopied'));
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <QuoteNumberHeader
              number={event.quoteNumber}
              createdBy={event.createdByName && t('card.createdBy', { name: event.createdByName })}
              onCopy={() => void handleCopyNumber()}
              showQuoteLink
              onViewQuote={() => router.push(`/admin/quotes/${event.quoteId}`)}
              quoteId={event.quoteId}
              createdByName={event.createdByName}
              assignedToName={event.assignedToName}
            />

            <div>
              <Typography.Title className="font-heading text-lg text-brown m-0! mb-3">
                {t('detail.eventDetailsTitle')}
              </Typography.Title>
              <div className="flex flex-col gap-1">
                {event.eventTypeName && (
                  <span className="text-base text-gray-500">{event.eventTypeName}</span>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base text-gray-500">
                    {event.eventDate ? date(event.eventDate) : '—'}
                    {event.eventTime ? ` · ${event.eventTime}` : ''}
                  </span>
                  <Tag color={EVENT_STATUS_COLORS[event.status]}>{t(`status.${event.status}`)}</Tag>
                </div>
                <AddressLines
                  address={event.address}
                  city={event.city}
                  state={event.state}
                  className="text-base text-gray-500"
                />
              </div>
            </div>
          </div>

          <Space wrap>
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
