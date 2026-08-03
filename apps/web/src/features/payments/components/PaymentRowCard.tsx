'use client';
import { Card } from 'antd';
import { useTranslation } from 'react-i18next';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { PAYMENT_METHOD_ICONS } from '../helpers';
import type { Payment } from '../types';

interface PaymentRowCardProps {
  row: Payment;
  onClick: () => void;
}

export function PaymentRowCard({ row, onClick }: PaymentRowCardProps) {
  const { t } = useTranslation('payments');
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();
  const MethodIcon = PAYMENT_METHOD_ICONS[row.method];

  return (
    <Card size="small" onClick={onClick} className="cursor-pointer">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{row.clientName}</span>
        <span className="font-semibold">{money(row.amount)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-base text-gray-500">
        <span className="flex items-center gap-1.5">
          <MethodIcon size={14} className="shrink-0" />
          {t(`paymentMethods.${row.method}`)}
        </span>
        <span className="text-xs">{date(row.paidAt)}</span>
      </div>
      {row.eventTypeName && <div className="mt-1 text-xs text-gray-500">{row.eventTypeName}</div>}
    </Card>
  );
}
