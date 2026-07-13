import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateOptionGroupInput, UpdateOptionGroupInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useOptionGroupMutations() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const invalidate = () => qc.invalidateQueries(trpc.products.pathFilter());

  const create = useMutation(trpc.products.groups.create.mutationOptions({ onSuccess: invalidate, onError }));
  const update = useMutation(trpc.products.groups.update.mutationOptions({ onSuccess: invalidate, onError }));
  const toggleActive = useMutation(
    trpc.products.groups.toggleActive.mutationOptions({ onSuccess: invalidate, onError }),
  );
  const reorder = useMutation(trpc.products.groups.reorder.mutationOptions({ onSuccess: invalidate, onError }));

  return {
    createOptionGroup: (data: CreateOptionGroupInput) => create.mutateAsync(data),
    updateOptionGroup: (id: string, data: UpdateOptionGroupInput) => update.mutateAsync({ id, data }),
    toggleOptionGroupActive: (id: string, isActive: boolean) => toggleActive.mutateAsync({ id, isActive }),
    reorderOptionGroups: (ids: string[]) => reorder.mutateAsync({ ids }),
    isPending: create.isPending || update.isPending,
  };
}
