'use client';
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { paymentMethodSchema, type PaymentMethod } from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { PAYMENT_METHOD_ICONS, PAYMENT_STATUS_COLORS } from '../../helpers';
import { useRegisterEventPayment } from '../../hooks/useEventPayments';
import type { EventDetail } from '../../types';

interface EventPaymentsProps {
  event: EventDetail;
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
  const [form] = Form.useForm<PaymentFormValues>();
  const { registerPayment, isPending } = useRegisterEventPayment();

  const balance = event.totalAmount - event.totalPaid;

  const onFinish = async (values: PaymentFormValues) => {
    await registerPayment(event.id, {
      method: values.method!,
      amount: Math.round((values.amount ?? 0) * 100),
      paidAt: values.paidAt.format('YYYY-MM-DD'),
      reference: values.reference,
      notes: values.notes,
    });
    form.resetFields();
  };

  const onPercentChange = (percent: number) => {
    const amountCents = Math.min(balance, Math.round((event.totalAmount * percent) / 100));
    form.setFieldValue('amount', amountCents / 100);
  };

  return (
    <Card
      title={t('detail.payments.title')}
      extra={
        <Tag color={PAYMENT_STATUS_COLORS[event.paymentStatus]}>
          {t(`detail.payments.status.${event.paymentStatus}`)}
        </Tag>
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="text-gray-500">{t('detail.payments.total')}: </span>
          <span className="font-semibold">{money(event.totalAmount)}</span>
        </span>
        <span>
          <span className="text-gray-500">{t('detail.payments.paid')}: </span>
          <span className="font-semibold text-green-600">{money(event.totalPaid)}</span>
        </span>
        <span>
          <span className="text-gray-500">{t('detail.payments.balance')}: </span>
          <span className="font-semibold text-red-600">{money(balance)}</span>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <Typography.Text strong className="block">
            {t('detail.payments.register.title')}
          </Typography.Text>
          <Form<PaymentFormValues>
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ paidAt: dayjs() }}
            disabled={balance <= 0}
            requiredMark={false}
            className="mt-2"
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
                  <InputNumber
                    className="w-full"
                    min={0.01}
                    max={balance > 0 ? balance / 100 : undefined}
                    precision={2}
                    prefix="$"
                  />
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
                <Input />
              </Form.Item>
            </div>
            <Button className="mt-3" type="primary" htmlType="submit" loading={isPending}>
              {t('detail.payments.register.submit')}
            </Button>
          </Form>
        </div>

        <div>
          <Typography.Text strong className="block">
            {t('detail.payments.history.title')}
          </Typography.Text>
          {event.payments.length === 0 ? (
            <Empty
              className="mt-2"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('detail.payments.history.empty')}
            />
          ) : (
            <div className="mt-2 flex flex-col">
              {event.payments.map((payment, index) => {
                const MethodIcon = PAYMENT_METHOD_ICONS[payment.method];
                return (
                  <div
                    key={payment.id}
                    className={`flex flex-col gap-1 py-2 text-sm ${index > 0 ? 'border-line border-t' : ''}`}
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
                    {payment.notes && (
                      <span className="text-xs text-gray-500">{payment.notes}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
