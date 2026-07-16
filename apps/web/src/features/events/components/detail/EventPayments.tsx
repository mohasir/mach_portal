'use client';
import { useEffect, useState } from 'react';
import { Button, Card, Select, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { paymentMethodSchema, type PaymentMethod } from '@repo/schemas';
import { useQuote } from '@/features/quotes';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { useUpdateEventPayment } from '../../hooks/useEventPayments';
import type { EventDetail } from '../../types';

interface EventPaymentsProps {
  event: EventDetail;
}

export function EventPayments({ event }: EventPaymentsProps) {
  const { t } = useTranslation('events');
  const { money } = useMoneyFormatter();
  const { data: quote, isLoading: isQuoteLoading } = useQuote(event.quoteId);
  const { updatePayment, isPending } = useUpdateEventPayment();

  const [depositPaid, setDepositPaid] = useState(event.depositPaid);
  const [balancePaid, setBalancePaid] = useState(event.balancePaid);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(event.paymentMethod);

  useEffect(() => {
    setDepositPaid(event.depositPaid);
    setBalancePaid(event.balancePaid);
    setPaymentMethod(event.paymentMethod);
  }, [event.depositPaid, event.balancePaid, event.paymentMethod]);

  const isDirty =
    depositPaid !== event.depositPaid ||
    balancePaid !== event.balancePaid ||
    paymentMethod !== event.paymentMethod;

  const onSave = () =>
    updatePayment(event.id, {
      depositPaid,
      balancePaid,
      paymentMethod: paymentMethod ?? undefined,
    });

  return (
    <Card size="small" title={t('detail.payments.title')} loading={isQuoteLoading}>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">{t('detail.payments.total')}</span>
          <span className="font-semibold">{money(event.totalAmount)}</span>
        </div>
        {quote && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">
                {t('detail.payments.deposit')} · {money(quote.depositAmount)}
              </span>
              <Switch checked={depositPaid} onChange={setDepositPaid} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">
                {t('detail.payments.balance')} · {money(quote.total - quote.depositAmount)}
              </span>
              <Switch checked={balancePaid} onChange={setBalancePaid} />
            </div>
          </>
        )}
      </div>

      <div className="mt-3">
        <span className="mb-1 block text-xs text-gray-500">
          {t('detail.payments.paymentMethod')}
        </span>
        <Select<PaymentMethod | null>
          className="w-full"
          allowClear
          value={paymentMethod}
          placeholder={t('detail.payments.paymentMethodPlaceholder')}
          options={paymentMethodSchema.options.map((method) => ({
            value: method,
            label: t(`paymentMethods.${method}`),
          }))}
          onChange={(value) => setPaymentMethod(value ?? null)}
        />
      </div>

      <Button
        className="mt-3"
        type="primary"
        block
        disabled={!isDirty}
        loading={isPending}
        onClick={onSave}
      >
        {t('detail.payments.save')}
      </Button>
    </Card>
  );
}
