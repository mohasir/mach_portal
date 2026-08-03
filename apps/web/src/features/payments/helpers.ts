import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  ScrollText,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import dayjs, { type Dayjs } from 'dayjs';
import type { PaymentMethod } from '@repo/schemas';

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  transfer: ArrowLeftRight,
  check: ScrollText,
  zelle: Wallet,
};

export interface DateRangePresetLabels {
  today: string;
  thisWeek: string;
  thisMonth: string;
}

export function buildDateRangePresets(
  labels: DateRangePresetLabels,
): { label: string; value: [Dayjs, Dayjs] }[] {
  const now = dayjs();
  return [
    { label: labels.today, value: [now.startOf('day'), now.endOf('day')] },
    { label: labels.thisWeek, value: [now.startOf('week'), now.endOf('week')] },
    { label: labels.thisMonth, value: [now.startOf('month'), now.endOf('month')] },
  ];
}
