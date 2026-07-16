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

export function useEventsCalendar(query: EventsCalendarQuery, options?: { enabled?: boolean }) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.events.calendar.queryOptions(query),
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  });
}
