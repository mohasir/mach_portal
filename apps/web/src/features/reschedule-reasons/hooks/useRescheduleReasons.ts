import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateRescheduleReasonInput,
  RescheduleReasonsListQuery,
  UpdateRescheduleReasonInput,
} from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useRescheduleReasonsList(
  query: RescheduleReasonsListQuery,
  options?: { enabled?: boolean },
) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.rescheduleReasons.list.queryOptions(query),
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  });
}

export function useCreateRescheduleReason() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.rescheduleReasons.create.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.rescheduleReasons.list.queryFilter()),
      onError,
    }),
  );

  return {
    createRescheduleReason: (data: CreateRescheduleReasonInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}

export function useUpdateRescheduleReason() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.rescheduleReasons.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.rescheduleReasons.list.queryFilter()),
      onError,
    }),
  );

  return {
    updateRescheduleReason: (id: string, data: UpdateRescheduleReasonInput) =>
      mutation.mutateAsync({ id, data }),
    isPending: mutation.isPending,
  };
}

export function useToggleRescheduleReasonActive() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.rescheduleReasons.toggleActive.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.rescheduleReasons.list.queryFilter()),
      onError,
    }),
  );

  return {
    toggleActive: (id: string, isActive: boolean) => mutation.mutateAsync({ id, isActive }),
    isPending: mutation.isPending,
  };
}
