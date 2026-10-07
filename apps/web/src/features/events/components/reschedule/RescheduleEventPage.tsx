'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Form, Input, Select, Skeleton } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { RescheduleEventInput } from '@repo/schemas';
import { AccessDenied } from '@/components/shared/AccessDenied';
import { useConfirmModal } from '@/components/shared/ConfirmDialogs';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { PageHeader } from '@/components/shared/PageHeader';
import { WrapperAlert } from '@/components/shared/WrapperAlert';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { WrapperDatePicker } from '@/components/shared/WrapperDatePicker';
import { WrapperTimePicker } from '@/components/shared/WrapperTimePicker';
import { useRescheduleReasonsList } from '@/features/reschedule-reasons';
import { useCan } from '@/lib/auth/useCan';
import { disabledPastDate, disabledPastTime } from '@/lib/date';
import { useApiError } from '@/lib/error/useApiError';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { isSameSchedule } from '../../helpers';
import { useEvent } from '../../hooks/useEvents';
import {
  useCheckReschedule,
  useFetchRescheduleCheck,
  useRescheduleEvent,
} from '../../hooks/useReschedule';
import { RescheduleConflicts } from './RescheduleConflicts';

interface RescheduleEventPageProps {
  eventId: string;
  returnTo?: string;
}

// Only in-app admin paths: `returnTo` comes from the URL, so anything else (another origin,
// a protocol-relative "//host") would turn the page into an open redirect.
const isSafeReturnPath = (path: string | undefined): path is string =>
  !!path && (path === '/admin' || path.startsWith('/admin/'));

interface RescheduleFormValues {
  eventDate?: Dayjs;
  eventTime?: Dayjs;
  reasonId?: string;
  note?: string;
}

const NOTE_MAX_LENGTH = 500;

export function RescheduleEventPage({ eventId, returnTo }: RescheduleEventPageProps) {
  const { t } = useTranslation('events');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const can = useCan();
  const { modal } = App.useApp();
  const isDesktop = useIsDesktop();
  const [confirmAction, confirmContextHolder] = useConfirmModal();
  const { date, time } = useDateFormatter();
  const [form] = Form.useForm<RescheduleFormValues>();

  const canReschedule = can({ [RESOURCES.EVENT]: [ACTIONS.RESCHEDULE] });
  const { data: event, isLoading } = useEvent(canReschedule ? eventId : undefined);
  const { data: reasons, isLoading: isReasonsLoading } = useRescheduleReasonsList(
    { isActive: true, sortBy: 'sortOrder', sortDir: 'asc' },
    { enabled: canReschedule },
  );
  const { rescheduleEvent, isPending } = useRescheduleEvent();
  const fetchCheck = useFetchRescheduleCheck();
  const onError = useApiError();
  const [isVerifying, setIsVerifying] = useState(false);

  const eventDate = Form.useWatch('eventDate', form);
  const eventTime = Form.useWatch('eventTime', form);
  const reasonId = Form.useWatch('reasonId', form);
  const eventDateStr = eventDate?.format('YYYY-MM-DD');
  const eventTimeStr = eventTime?.format('HH:mm');
  const isUnchanged =
    !!event && isSameSchedule(event, { eventDate: eventDateStr, eventTime: eventTimeStr });
  const { data: check, isChecking } = useCheckReschedule(
    eventId,
    isUnchanged ? undefined : eventDateStr,
    eventTimeStr,
  );

  const detailHref = `/admin/events/${eventId}`;
  const backHref = isSafeReturnPath(returnTo) ? returnTo : detailHref;
  const goBack = () => router.push(backHref);
  const isReschedulable = event?.status === 'upcoming';

  useEffect(() => {
    if (event && !isReschedulable) router.replace(detailHref);
  }, [event, isReschedulable, router, detailHref]);

  if (!canReschedule) return <AccessDenied />;

  const title = t('reschedule.title');
  if (isLoading || isReasonsLoading || !event || !isReschedulable) {
    return (
      <div>
        <PageHeader title={title} onBack={goBack} />
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  const reasonOptions = (reasons?.items ?? []).map((reason) => ({
    value: reason.id,
    label: reason.name,
  }));
  const selectedReason = reasons?.items.find((reason) => reason.id === reasonId);
  const noteRequired = !!selectedReason?.requiresNote;

  const hasAnyConflict =
    (check?.staffConflicts.length ?? 0) > 0 || (check?.eventConflicts.length ?? 0) > 0;
  const scheduleStatus =
    !eventDateStr || isUnchanged
      ? undefined
      : isChecking
        ? ('validating' as const)
        : hasAnyConflict
          ? ('warning' as const)
          : ('success' as const);

  const currentTime = event.eventTime ? dayjs(event.eventTime, ['HH:mm', 'H:mm'], true) : null;
  const initialValues: RescheduleFormValues = {
    eventDate: event.eventDate ? dayjs(event.eventDate) : undefined,
    eventTime: currentTime?.isValid() ? currentTime : undefined,
    reasonId: reasons?.items[0]?.id,
  };
  // Legacy free-text times ("6pm") can't be loaded into the picker; saving without picking a
  // time would clear them, so the user is told up front.
  const hasUnparsedTime = !!event.eventTime && !currentTime?.isValid();

  const save = async (input: RescheduleEventInput) => {
    try {
      await rescheduleEvent(input);
      goBack();
    } catch {
      // Surfaced by useApiError.
    }
  };

  const onFinish = async (values: RescheduleFormValues) => {
    if (!values.eventDate || !values.reasonId) return;
    const input: RescheduleEventInput = {
      eventId,
      eventDate: values.eventDate.format('YYYY-MM-DD'),
      eventTime: values.eventTime?.format('HH:mm'),
      reasonId: values.reasonId,
      note: values.note,
    };

    setIsVerifying(true);
    let staffConflictCount: number;
    try {
      const fresh = await fetchCheck({
        eventId,
        eventDate: input.eventDate,
        eventTime: input.eventTime,
      });
      staffConflictCount = fresh.staffConflicts.length;
    } catch (error) {
      onError(error);
      return;
    } finally {
      setIsVerifying(false);
    }

    if (staffConflictCount === 0) return save(input);
    const options = {
      title: t('reschedule.staffConflictConfirm.title'),
      content: t('reschedule.staffConflictConfirm.content'),
      okText: t('reschedule.staffConflictConfirm.ok'),
      onOk: () => void save(input),
    };
    if (!isDesktop) return confirmAction(options);
    modal.confirm(options);
  };

  const scheduleStatusProps = {
    hasFeedback: !!scheduleStatus,
    validateStatus: scheduleStatus,
  };

  const actionButtons = (
    <>
      <Button className="flex-1 lg:flex-none" onClick={goBack} disabled={isPending}>
        {tc('cancel')}
      </Button>
      <Button
        className="flex-1 lg:flex-none"
        type="primary"
        onClick={() => form.submit()}
        disabled={isUnchanged}
        loading={isPending || isVerifying}
      >
        {t('reschedule.submit')}
      </Button>
    </>
  );

  return (
    <div className="pb-24 lg:pb-0">
      <PageHeader title={title} onBack={goBack} />
      <div className="flex flex-col gap-4">
        <WrapperCard title={t('reschedule.summaryTitle')}>
          <div className="flex flex-col gap-1 text-base">
            <span className="font-medium">{event.clientName}</span>
            <span className="text-gray-500">#{event.quoteNumber}</span>
            <span className="text-gray-500">
              {t('reschedule.currentSchedule')}: {event.eventDate ? date(event.eventDate) : '—'}
              {event.eventTime ? ` · ${time(event.eventTime)}` : ''}
            </span>
          </div>
        </WrapperCard>

        <WrapperCard title={t('reschedule.formTitle')}>
          <Form<RescheduleFormValues>
            form={form}
            layout="vertical"
            initialValues={initialValues}
            onFinish={onFinish}
            requiredMark={false}
          >
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Form.Item
                name="eventDate"
                label={<FieldLabel title={t('reschedule.date')} required />}
                rules={[{ required: true, message: t('reschedule.validation.dateRequired') }]}
                {...scheduleStatusProps}
              >
                <WrapperDatePicker
                  className="w-full"
                  sheetTitle={t('reschedule.date')}
                  disabledDate={disabledPastDate}
                />
              </Form.Item>
              <Form.Item
                name="eventTime"
                label={<FieldLabel title={t('reschedule.time')} />}
                {...scheduleStatusProps}
              >
                <WrapperTimePicker
                  className="w-full"
                  sheetTitle={t('reschedule.time')}
                  minuteStep={15}
                  classNames={{ popup: { content: 'min-w-[150px]' } }}
                  disabledTime={disabledPastTime(eventDate)}
                />
              </Form.Item>
            </div>
            <RescheduleConflicts check={check} isChecking={isChecking} />
            {hasUnparsedTime && (
              <WrapperAlert
                className="mb-4"
                type="info"
                showIcon
                closeable={false}
                description={t('reschedule.unparsedTime', { time: event.eventTime })}
              />
            )}

            <Form.Item
              name="reasonId"
              label={<FieldLabel title={t('reschedule.reason')} required />}
              rules={[{ required: true, message: t('reschedule.validation.reasonRequired') }]}
            >
              <Select placeholder={t('reschedule.reasonPlaceholder')} options={reasonOptions} />
            </Form.Item>

            <Form.Item
              name="note"
              label={<FieldLabel title={t('reschedule.note')} required={noteRequired} />}
              dependencies={['reasonId']}
              rules={[
                {
                  required: noteRequired,
                  whitespace: true,
                  message: t('reschedule.validation.noteRequired'),
                },
                { max: NOTE_MAX_LENGTH },
              ]}
            >
              <Input.TextArea
                autoSize={{ minRows: 2, maxRows: 5 }}
                maxLength={NOTE_MAX_LENGTH}
                showCount
                placeholder={t('reschedule.notePlaceholder')}
              />
            </Form.Item>

            {isDesktop && <div className="flex justify-end gap-2">{actionButtons}</div>}
          </Form>
        </WrapperCard>
      </div>
      {!isDesktop && (
        <div className="border-line fixed inset-x-0 bottom-0 z-10 border-t bg-white p-3">
          <div className="mb-4 flex gap-2">{actionButtons}</div>
        </div>
      )}
      {confirmContextHolder}
    </div>
  );
}
