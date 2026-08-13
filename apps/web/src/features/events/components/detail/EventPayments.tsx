'use client';
import { useState } from 'react';
import { App, Button, DatePicker, Empty, Form, Image, Input, Select, Tag } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { FileText, Paperclip, User, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { paymentMethodSchema, type PaymentMethod } from '@repo/schemas';
import { AttachmentUploadModal } from '@/components/shared/Attachment';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { useDeleteConfirm } from '@/components/shared/ConfirmDialogs';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { MoneyInput } from '@/components/shared/Inputs/MoneyInput';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useCan } from '@/lib/auth/useCan';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { PAYMENT_METHOD_ICONS, PAYMENT_STATUS_COLORS } from '../../helpers';
import {
  useRegisterEventPayment,
  useRemoveEventPaymentAttachment,
  useUploadEventPaymentAttachment,
} from '../../hooks/useEventPayments';
import type { EventDetail } from '../../types';

export type EventDetailWithPayments = Omit<
  EventDetail,
  'payments' | 'totalPaid' | 'paymentStatus'
> & {
  payments: NonNullable<EventDetail['payments']>;
  totalPaid: NonNullable<EventDetail['totalPaid']>;
  paymentStatus: NonNullable<EventDetail['paymentStatus']>;
};

interface EventPaymentsProps {
  event: EventDetailWithPayments;
}

interface PaymentFormValues {
  method?: PaymentMethod;
  percent?: number;
  amount?: number;
  paidAt: Dayjs;
  reference?: string;
  notes?: string;
}

const PERCENT_OPTIONS = [20, 30, 40, 50];

export function EventPayments({ event }: EventPaymentsProps) {
  const { t } = useTranslation('events');
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();
  const { modal } = App.useApp();
  const isDesktop = useIsDesktop();
  const can = useCan();
  const canRegister = can({ [RESOURCES.PAYMENT]: [ACTIONS.CREATE] });
  const canUploadAttachment = can({ [RESOURCES.PAYMENT]: [ACTIONS.UPLOAD_ATTACHMENT] });
  const canRemoveAttachment = can({ [RESOURCES.PAYMENT]: [ACTIONS.DELETE] });
  const [confirmDelete, deleteContextHolder] = useDeleteConfirm();
  const [form] = Form.useForm<PaymentFormValues>();
  const { registerPayment, isPending } = useRegisterEventPayment();
  const { uploadUrl, onUploaded, onUploadError } = useUploadEventPaymentAttachment();
  const { removeAttachment } = useRemoveEventPaymentAttachment();
  const [uploadPaymentId, setUploadPaymentId] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const balance = event.totalAmount - event.totalPaid;

  const onFinish = async (values: PaymentFormValues) => {
    await registerPayment(event.id, {
      method: values.method!,
      amount: values.amount ?? 0,
      paidAt: values.paidAt.format('YYYY-MM-DD'),
      reference: values.reference,
      notes: values.notes,
    });
    form.resetFields();
    setRegisterOpen(false);
  };

  const onPercentChange = (percent: number) => {
    const amountCents = Math.min(balance, Math.round((event.totalAmount * percent) / 100));
    form.setFieldValue('amount', amountCents);
  };

  const onRemoveAttachment = (attachmentId: string) => {
    const options = {
      title: t('detail.payments.attachments.removeConfirmTitle'),
      content: t('detail.payments.attachments.removeConfirmContent'),
      onOk: () => removeAttachment(event.id, attachmentId),
    };
    if (!isDesktop) return confirmDelete(options);
    modal.confirm({ ...options, okButtonProps: { danger: true } });
  };

  return (
    <div className="flex flex-col gap-4">
      <WrapperCard
        title={t('detail.payments.title')}
        extra={
          <Tag color={PAYMENT_STATUS_COLORS[event.paymentStatus]}>
            {t(`detail.payments.status.${event.paymentStatus}`)}
          </Tag>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500 text-xs">{t('detail.payments.paid')}</span>
            <span className="text-2xl font-semibold text-green-600">{money(event.totalPaid)}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-gray-500 text-xs">{t('detail.payments.balance')}</span>
            <span className="text-2xl font-semibold text-red-600">{money(balance)}</span>
          </div>
        </div>

        <div className="border-line mt-4 flex items-center justify-between border-t pt-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500 text-xs">{t('detail.payments.total')}</span>
            <span className="text-base font-semibold">{money(event.totalAmount)}</span>
          </div>
          {canRegister && (
            <Button type="primary" disabled={balance <= 0} onClick={() => setRegisterOpen(true)}>
              {t('detail.payments.register.title')}
            </Button>
          )}
        </div>
      </WrapperCard>

      <WrapperCard title={t('detail.payments.history.title')}>
        {event.payments.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('detail.payments.history.empty')}
          />
        ) : (
          <div className="flex flex-col">
            {event.payments.map((payment, index) => {
              const MethodIcon = PAYMENT_METHOD_ICONS[payment.method];
              return (
                <div
                  key={payment.id}
                  className={`flex flex-col gap-1 py-2 text-base ${index > 0 ? 'border-line border-t' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{money(payment.amount)}</span>
                    <span className="text-xs text-gray-500">{date(payment.paidAt)}</span>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <MethodIcon size={14} className="shrink-0" />
                    {t(`paymentMethods.${payment.method}`)}
                    {payment.reference ? ` · ${payment.reference}` : ''}
                  </span>
                  {payment.createdByName && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <User size={14} className="shrink-0" />
                      {t('detail.payments.history.registeredBy', { name: payment.createdByName })}
                    </span>
                  )}
                  {payment.notes && <span className="text-xs text-gray-500">{payment.notes}</span>}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {payment.attachments.map((attachment) => (
                      <div key={attachment.id} className="group relative">
                        {attachment.mimeType.startsWith('image/') ? (
                          <Image
                            src={attachment.url}
                            alt={attachment.fileName}
                            width={36}
                            height={36}
                            className="rounded object-cover"
                          />
                        ) : (
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            title={attachment.fileName}
                            className="border-line text-gray-500 flex h-9 w-9 items-center justify-center rounded border"
                          >
                            <FileText size={16} />
                          </a>
                        )}
                        {canRemoveAttachment && (
                          <button
                            type="button"
                            onClick={() => onRemoveAttachment(attachment.id)}
                            aria-label={t('detail.payments.attachments.remove')}
                            className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-gray-500 opacity-0 shadow transition-opacity group-hover:opacity-100 hover:text-red-600"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                    {canUploadAttachment && (
                      <Button
                        size="small"
                        type="dashed"
                        icon={<Paperclip size={12} />}
                        onClick={() => setUploadPaymentId(payment.id)}
                      >
                        {t('detail.payments.attachments.upload')}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </WrapperCard>

      <BottomSheet
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title={t('detail.payments.register.title')}
        footerClassName="shadow-[0_-4px_8px_-2px_rgba(0,0,0,0.08)]"
        footer={
          <div className="py-2 pt-4">
            <Button type="primary" block loading={isPending} onClick={() => form.submit()}>
              {t('detail.payments.register.submit')}
            </Button>
          </div>
        }
      >
        <div className="p-4">
          <Form<PaymentFormValues>
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ paidAt: dayjs() }}
            requiredMark={false}
          >
            <div className="flex flex-col gap-3">
              <Form.Item
                name="method"
                label={<FieldLabel title={t('detail.payments.register.method')} required />}
                rules={[{ required: true }]}
                className="mb-0"
              >
                <Select
                  placeholder={t('detail.payments.register.methodPlaceholder')}
                  options={paymentMethodSchema.options.map((method) => ({
                    value: method,
                    label: t(`paymentMethods.${method}`),
                  }))}
                />
              </Form.Item>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Form.Item
                  name="percent"
                  label={<FieldLabel title={t('detail.payments.register.percent')} />}
                  className="mb-0"
                >
                  <Select
                    allowClear
                    placeholder={t('detail.payments.register.percentPlaceholder')}
                    options={PERCENT_OPTIONS.map((percent) => ({
                      value: percent,
                      label: `${percent}%`,
                    }))}
                    onChange={onPercentChange}
                  />
                </Form.Item>
                <Form.Item
                  name="amount"
                  label={<FieldLabel title={t('detail.payments.register.amount')} required />}
                  rules={[{ required: true }]}
                  className="mb-0"
                >
                  <MoneyInput className="w-full" min={1} max={balance > 0 ? balance : undefined} />
                </Form.Item>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Form.Item
                  name="paidAt"
                  label={<FieldLabel title={t('detail.payments.register.date')} required />}
                  rules={[{ required: true }]}
                  className="mb-0"
                >
                  <DatePicker className="w-full" />
                </Form.Item>
                <Form.Item
                  name="reference"
                  label={<FieldLabel title={t('detail.payments.register.reference')} />}
                  className="mb-0"
                >
                  <Input placeholder={t('detail.payments.register.referencePlaceholder')} />
                </Form.Item>
              </div>
              <Form.Item
                name="notes"
                label={<FieldLabel title={t('detail.payments.register.notes')} />}
                className="mb-0"
              >
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
              </Form.Item>
            </div>
          </Form>
        </div>
      </BottomSheet>

      <AttachmentUploadModal
        open={!!uploadPaymentId}
        onClose={() => setUploadPaymentId(null)}
        title={t('detail.payments.attachments.uploadModalTitle')}
        dragText={t('detail.payments.attachments.dragText')}
        hintText={(maxSizeMb) => t('detail.payments.attachments.dragHint', { maxSize: maxSizeMb })}
        invalidTypeMessage={t('detail.payments.attachments.invalidType')}
        tooLargeMessage={t('detail.payments.attachments.tooLarge')}
        action={uploadPaymentId ? uploadUrl(uploadPaymentId) : ''}
        onUploaded={onUploaded}
        onUploadError={onUploadError}
      />
      {deleteContextHolder}
    </div>
  );
}
