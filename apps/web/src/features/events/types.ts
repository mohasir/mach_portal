import type { RouterOutputs } from '@/lib/trpc/types';

export type Event = RouterOutputs['events']['list']['items'][number];
export type EventDetail = RouterOutputs['events']['getById'];
export type EventCalendarItem = RouterOutputs['events']['calendar'][number];
