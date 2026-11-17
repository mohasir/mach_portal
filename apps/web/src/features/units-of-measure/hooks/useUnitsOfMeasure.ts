import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUnitInput, UnitsOfMeasureListQuery, UpdateUnitInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useUnitsOfMeasureList(query: UnitsOfMeasureListQuery) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.unitsOfMeasure.list.queryOptions(query),
    placeholderData: keepPreviousData,
  });
}

/** Active units for the product form (also allowed to whoever edits products). */
export function useUnitOptions() {
  const trpc = useTRPC();
  return useQuery(trpc.unitsOfMeasure.options.queryOptions());
}

// The product catalog embeds each product's unit (name, plural, code), so a unit change also
// refreshes it.
function useInvalidateUnits() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries(trpc.unitsOfMeasure.list.queryFilter()),
      qc.invalidateQueries(trpc.unitsOfMeasure.options.queryFilter()),
      qc.invalidateQueries(trpc.products.pathFilter()),
    ]);
}

export function useCreateUnit() {
  const trpc = useTRPC();
  const invalidate = useInvalidateUnits();
  const onError = useApiError();
  const mutation = useMutation(
    trpc.unitsOfMeasure.create.mutationOptions({ onSuccess: invalidate, onError }),
  );
  return {
    createUnit: (data: CreateUnitInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}

export function useUpdateUnit() {
  const trpc = useTRPC();
  const invalidate = useInvalidateUnits();
  const onError = useApiError();
  const mutation = useMutation(
    trpc.unitsOfMeasure.update.mutationOptions({ onSuccess: invalidate, onError }),
  );
  return {
    updateUnit: (id: string, data: UpdateUnitInput) => mutation.mutateAsync({ id, data }),
    isPending: mutation.isPending,
  };
}

export function useToggleUnitActive() {
  const trpc = useTRPC();
  const invalidate = useInvalidateUnits();
  const onError = useApiError();
  const disable = useMutation(
    trpc.unitsOfMeasure.disable.mutationOptions({ onSuccess: invalidate, onError }),
  );
  const enable = useMutation(
    trpc.unitsOfMeasure.enable.mutationOptions({ onSuccess: invalidate, onError }),
  );
  return {
    toggleActive: (id: string, isActive: boolean) =>
      (isActive ? enable : disable).mutateAsync({ id }),
    isPending: disable.isPending || enable.isPending,
  };
}
