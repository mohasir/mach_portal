import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  ScrollText,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { normalizeEventTime, type PaymentMethod } from '@repo/schemas';
import { isPastDate } from '@/lib/date';
import type { Event, EventDetail } from './types';

/** Display-only status: a past-due event is still `upcoming` for every business rule. */
export type EventDisplayStatus = Event['status'] | 'pastDue';

export const EVENT_STATUS_COLORS: Record<EventDisplayStatus, string> = {
  upcoming: 'blue',
  pastDue: 'orange',
  completed: 'green',
  cancelled: 'red',
};

/** Not marked as completed although the event date already went by. */
export const isEventPastDue = (event: Pick<Event, 'status' | 'eventDate'>) =>
  event.status === 'upcoming' && isPastDate(event.eventDate);

export const getEventDisplayStatus = (
  event: Pick<Event, 'status' | 'eventDate'>,
): EventDisplayStatus => (isEventPastDue(event) ? 'pastDue' : event.status);

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

type Schedule = { eventDate: string | null; eventTime: string | null };

// Mirrors the API's SAME_SCHEDULE rule, so the form can block a save the server would reject.
export const isSameSchedule = (
  current: Schedule,
  next: { eventDate?: string; eventTime?: string },
) =>
  !!next.eventDate &&
  next.eventDate === current.eventDate &&
  normalizeEventTime(next.eventTime) === normalizeEventTime(current.eventTime);
