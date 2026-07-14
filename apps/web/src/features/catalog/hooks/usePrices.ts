import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateProductTiersInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function usePricesList() {
  const trpc = useTRPC();
  return useQuery(trpc.products.prices.list.queryOptions());
}

export function useUpdatePriceTiers() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const mutation = useMutation(
    trpc.products.prices.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.products.prices.list.queryFilter()),
      onError,
    }),
  );

  return {
    updateTiers: (id: string, data: UpdateProductTiersInput) => mutation.mutateAsync({ id, data }),
    isPending: mutation.isPending,
  };
}
