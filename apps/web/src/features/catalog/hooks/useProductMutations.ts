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
  const toggleActive = useMutation(
    trpc.products.toggleActive.mutationOptions({ onSuccess: invalidate, onError }),
  );
  const reorder = useMutation(trpc.products.reorder.mutationOptions({ onSuccess: invalidate, onError }));

  return {
    createProduct: (data: CreateProductInput) => create.mutateAsync(data),
    updateProduct: (id: string, data: UpdateProductInput) => update.mutateAsync({ id, data }),
    toggleProductActive: (id: string, isActive: boolean) => toggleActive.mutateAsync({ id, isActive }),
    reorderProducts: (ids: string[]) => reorder.mutateAsync({ ids }),
    isPending: create.isPending || update.isPending,
  };
}
