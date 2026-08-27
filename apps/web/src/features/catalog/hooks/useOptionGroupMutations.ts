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
  const disable = useMutation(
    trpc.products.groups.disable.mutationOptions({ onSuccess: invalidate, onError }),
  );
  const enable = useMutation(
    trpc.products.groups.enable.mutationOptions({ onSuccess: invalidate, onError }),
  );
  const reorder = useMutation(trpc.products.groups.reorder.mutationOptions({ onSuccess: invalidate, onError }));

  return {
    createOptionGroup: (data: CreateOptionGroupInput) => create.mutateAsync(data),
    updateOptionGroup: (id: string, data: UpdateOptionGroupInput) => update.mutateAsync({ id, data }),
    disableOptionGroup: (id: string) => disable.mutateAsync({ id }),
    enableOptionGroup: (id: string) => enable.mutateAsync({ id }),
    reorderOptionGroups: (ids: string[]) => reorder.mutateAsync({ ids }),
    isPending: create.isPending || update.isPending,
  };
}
