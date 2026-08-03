'use client';
import { Card } from 'antd';
import { IconBadge } from '@/components/shared/IconBadge';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { PAYMENT_METHOD_ICONS } from '../helpers';
import type { Payment } from '../types';

interface PaymentRowCardProps {
  row: Payment;
  onClick: () => void;
}

export function PaymentRowCard({ row, onClick }: PaymentRowCardProps) {
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();

  return (
    <div onClick={onClick} className="cursor-pointer px-3">
      <div className="flex items-center gap-3">
        <IconBadge icon={PAYMENT_METHOD_ICONS[row.method]} shape="square" className="bg-gray-100" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{row.clientName}</div>
          <div className="text-xs text-gray-500">{date(row.paidAt)}</div>
        </div>
        <span className="font-semibold text-base">{money(row.amount)}</span>
      </div>
    </div>
  );
}
