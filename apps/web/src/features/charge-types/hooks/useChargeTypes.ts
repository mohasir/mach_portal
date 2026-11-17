import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChargeTypesListQuery,
  CreateChargeTypeInput,
  UpdateChargeTypeInput,
} from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useChargeTypesList(query: ChargeTypesListQuery) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.chargeTypes.list.queryOptions(query),
    placeholderData: keepPreviousData,
  });
}

/** Active types for the quote builder (also allowed to whoever creates or edits quotes). */
export function useChargeTypeOptions(enabled = true) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.chargeTypes.options.queryOptions(), enabled });
}

function useInvalidateChargeTypes() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries(trpc.chargeTypes.list.queryFilter()),
      qc.invalidateQueries(trpc.chargeTypes.options.queryFilter()),
    ]);
}

export function useCreateChargeType() {
  const trpc = useTRPC();
  const invalidate = useInvalidateChargeTypes();
  const onError = useApiError();
  const mutation = useMutation(
    trpc.chargeTypes.create.mutationOptions({ onSuccess: invalidate, onError }),
  );
  return {
    createChargeType: (data: CreateChargeTypeInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}

export function useUpdateChargeType() {
  const trpc = useTRPC();
  const invalidate = useInvalidateChargeTypes();
  const onError = useApiError();
  const mutation = useMutation(
    trpc.chargeTypes.update.mutationOptions({ onSuccess: invalidate, onError }),
  );
  return {
    updateChargeType: (id: string, data: UpdateChargeTypeInput) =>
      mutation.mutateAsync({ id, data }),
    isPending: mutation.isPending,
  };
}

export function useToggleChargeTypeActive() {
  const trpc = useTRPC();
  const invalidate = useInvalidateChargeTypes();
  const onError = useApiError();
  const disable = useMutation(
    trpc.chargeTypes.disable.mutationOptions({ onSuccess: invalidate, onError }),
  );
  const enable = useMutation(
    trpc.chargeTypes.enable.mutationOptions({ onSuccess: invalidate, onError }),
  );
  return {
    toggleActive: (id: string, isActive: boolean) =>
      (isActive ? enable : disable).mutateAsync({ id }),
    isPending: disable.isPending || enable.isPending,
  };
}
