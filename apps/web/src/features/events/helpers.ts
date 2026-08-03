import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  ScrollText,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { PaymentMethod } from '@repo/schemas';
import type { Event, EventDetail } from './types';

export const EVENT_STATUS_COLORS: Record<Event['status'], string> = {
  upcoming: 'blue',
  completed: 'green',
  cancelled: 'red',
};

export const PAYMENT_STATUS_COLORS: Record<NonNullable<EventDetail['paymentStatus']>, string> = {
  pending: 'red',
  partial: 'orange',
  paid: 'green',
};

// Generic fallback (Wallet) covers any method without a distinct icon.
export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  transfer: ArrowLeftRight,
  check: ScrollText,
  zelle: Wallet,
};
