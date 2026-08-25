import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { NotificationsListQuery } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

// Sin websockets/push en este MVP — polling simple; barato porque son pocas filas.
const REFETCH_INTERVAL = 30_000;

export function useNotificationsList(query: NotificationsListQuery) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.notifications.list.queryOptions(query),
    placeholderData: keepPreviousData,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useUnreadNotificationsCount() {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.notifications.unreadCount.queryOptions(),
    refetchInterval: REFETCH_INTERVAL,
  });
}

const FEED_QUERY_KEY = ['notifications', 'feed'] as const;
const FEED_FIRST_PAGE_SIZE = 50;
const FEED_NEXT_PAGE_SIZE = 10;

// Center-screen infinite scroll: 50 first, then 10 at a time. A plain useInfiniteQuery driven
// by an explicit cursor (server-side offset) rather than trpc's infiniteQueryOptions, since the
// batch size itself needs to change between the first fetch and the following ones.
export function useNotificationsFeed() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useInfiniteQuery({
    queryKey: FEED_QUERY_KEY,
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      queryClient.fetchQuery(
        trpc.notifications.list.queryOptions({
          cursor: pageParam,
          pageSize: pageParam === undefined ? FEED_FIRST_PAGE_SIZE : FEED_NEXT_PAGE_SIZE,
          sortBy: 'createdAt',
          sortDir: 'desc',
        }),
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

function useInvalidateNotifications() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries(trpc.notifications.list.queryFilter());
    qc.invalidateQueries(trpc.notifications.unreadCount.queryFilter());
    qc.invalidateQueries({ queryKey: FEED_QUERY_KEY });
  };
}

export function useMarkNotificationRead() {
  const trpc = useTRPC();
  const onError = useApiError();
  const invalidate = useInvalidateNotifications();

  const mutation = useMutation(
    trpc.notifications.markRead.mutationOptions({ onSuccess: invalidate, onError }),
  );

  return {
    markNotificationRead: (id: string) => mutation.mutateAsync({ id }),
    isPending: mutation.isPending,
  };
}

export function useDismissNotification() {
  const trpc = useTRPC();
  const onError = useApiError();
  const invalidate = useInvalidateNotifications();

  const mutation = useMutation(
    trpc.notifications.dismiss.mutationOptions({ onSuccess: invalidate, onError }),
  );

  return {
    dismissNotification: (id: string) => mutation.mutateAsync({ id }),
    isPending: mutation.isPending,
  };
}

export function useMarkAllNotificationsRead() {
  const trpc = useTRPC();
  const onError = useApiError();
  const invalidate = useInvalidateNotifications();

  const mutation = useMutation(
    trpc.notifications.markAllRead.mutationOptions({ onSuccess: invalidate, onError }),
  );

  return {
    markAllNotificationsRead: () => mutation.mutateAsync(),
    isPending: mutation.isPending,
  };
}
