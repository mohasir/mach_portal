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
  const disable = useMutation(
    trpc.products.options.disable.mutationOptions({ onSuccess: invalidate, onError }),
  );
  const enable = useMutation(
    trpc.products.options.enable.mutationOptions({ onSuccess: invalidate, onError }),
  );
  const reorder = useMutation(trpc.products.options.reorder.mutationOptions({ onSuccess: invalidate, onError }));

  return {
    createOption: (data: CreateOptionInput) => create.mutateAsync(data),
    updateOption: (id: string, data: UpdateOptionInput) => update.mutateAsync({ id, data }),
    disableOption: (id: string) => disable.mutateAsync({ id }),
    enableOption: (id: string) => enable.mutateAsync({ id }),
    reorderOptions: (ids: string[]) => reorder.mutateAsync({ ids }),
    isPending: create.isPending || update.isPending,
  };
}
