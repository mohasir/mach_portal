import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateOptionInput, UpdateOptionInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useOptionMutations() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const invalidate = () => qc.invalidateQueries(trpc.products.pathFilter());

  const create = useMutation(trpc.products.options.create.mutationOptions({ onSuccess: invalidate, onError }));
  const update = useMutation(trpc.products.options.update.mutationOptions({ onSuccess: invalidate, onError }));
  const toggleActive = useMutation(
    trpc.products.options.toggleActive.mutationOptions({ onSuccess: invalidate, onError }),
  );
  const reorder = useMutation(trpc.products.options.reorder.mutationOptions({ onSuccess: invalidate, onError }));

  return {
    createOption: (data: CreateOptionInput) => create.mutateAsync(data),
    updateOption: (id: string, data: UpdateOptionInput) => update.mutateAsync({ id, data }),
    toggleOptionActive: (id: string, isActive: boolean) => toggleActive.mutateAsync({ id, isActive }),
    reorderOptions: (ids: string[]) => reorder.mutateAsync({ ids }),
    isPending: create.isPending || update.isPending,
  };
}
