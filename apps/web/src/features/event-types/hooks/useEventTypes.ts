import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateEventTypeInput, EventTypesListQuery, UpdateEventTypeInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useEventTypesList(query: EventTypesListQuery) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.eventTypes.list.queryOptions(query), placeholderData: keepPreviousData });
}

export function useCreateEventType() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.eventTypes.create.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.eventTypes.list.queryFilter()),
      onError,
    }),
  );

  return {
    createEventType: (data: CreateEventTypeInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}

export function useUpdateEventType() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.eventTypes.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.eventTypes.list.queryFilter()),
      onError,
    }),
  );

  return {
    updateEventType: (id: string, data: UpdateEventTypeInput) => mutation.mutateAsync({ id, data }),
    isPending: mutation.isPending,
  };
}

export function useToggleEventTypeActive() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.eventTypes.toggleActive.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.eventTypes.list.queryFilter()),
      onError,
    }),
  );

  return {
    toggleActive: (id: string, isActive: boolean) => mutation.mutateAsync({ id, isActive }),
    isPending: mutation.isPending,
  };
}
