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
  partial: 'gold',
  paid: 'green',
};

// Tailwind bg classes for the EventCard's left accent bar — separate from PAYMENT_STATUS_COLORS
// above (AntD preset color names, used for the Tag) since they're different color systems.
export const PAYMENT_STATUS_BAR_CLASSES: Record<
  NonNullable<EventDetail['paymentStatus']>,
  string
> = {
  pending: 'bg-red-500',
  partial: 'bg-yellow-400',
  paid: 'bg-green-600',
};

// Generic fallback (Wallet) covers any method without a distinct icon.
export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  transfer: ArrowLeftRight,
  check: ScrollText,
  zelle: Wallet,
};
