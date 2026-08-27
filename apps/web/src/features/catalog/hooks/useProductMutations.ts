import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateProductInput, UpdateProductInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useProductMutations() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const invalidate = () => qc.invalidateQueries(trpc.products.pathFilter());

  const create = useMutation(trpc.products.create.mutationOptions({ onSuccess: invalidate, onError }));
  const update = useMutation(trpc.products.update.mutationOptions({ onSuccess: invalidate, onError }));
  const disable = useMutation(trpc.products.disable.mutationOptions({ onSuccess: invalidate, onError }));
  const enable = useMutation(trpc.products.enable.mutationOptions({ onSuccess: invalidate, onError }));
  const reorder = useMutation(trpc.products.reorder.mutationOptions({ onSuccess: invalidate, onError }));

  return {
    createProduct: (data: CreateProductInput) => create.mutateAsync(data),
    updateProduct: (id: string, data: UpdateProductInput) => update.mutateAsync({ id, data }),
    disableProduct: (id: string) => disable.mutateAsync({ id }),
    enableProduct: (id: string) => enable.mutateAsync({ id }),
    reorderProducts: (ids: string[]) => reorder.mutateAsync({ ids }),
    isPending: create.isPending || update.isPending,
  };
}
