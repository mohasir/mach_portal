import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { EventsCalendarQuery, EventsListQuery } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';

export function useEventsList(query: EventsListQuery) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.events.list.queryOptions(query), placeholderData: keepPreviousData });
}

export function useEvent(id: string | undefined) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.events.getById.queryOptions({ id: id! }), enabled: !!id });
}

/** Bulk, unpaginated — one visible month at a time (mirrors `quotes.board` vs `quotes.list`). */
export function useEventsCalendar(query: EventsCalendarQuery) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.events.calendar.queryOptions(query),
    placeholderData: keepPreviousData,
  });
}
