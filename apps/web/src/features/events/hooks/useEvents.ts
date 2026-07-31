import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { paginationOf, type EventsCalendarQuery, type EventsListQuery } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';

export function useEventsList(query: EventsListQuery) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.events.list.queryOptions(query), placeholderData: keepPreviousData });
}

export function useEventsSegmentCounts() {
  const trpc = useTRPC();
  const base = { page: 1, pageSize: 1 } as const;
  const upcoming = useQuery({
    ...trpc.events.list.queryOptions({ ...base, segment: 'upcoming' }),
    placeholderData: keepPreviousData,
  });
  const past = useQuery({
    ...trpc.events.list.queryOptions({ ...base, segment: 'past' }),
    placeholderData: keepPreviousData,
  });
  const all = useQuery({
    ...trpc.events.list.queryOptions({ ...base, segment: 'all' }),
    placeholderData: keepPreviousData,
  });

  return {
    upcoming: paginationOf(upcoming.data)?.total ?? 0,
    past: paginationOf(past.data)?.total ?? 0,
    all: paginationOf(all.data)?.total ?? 0,
  };
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
