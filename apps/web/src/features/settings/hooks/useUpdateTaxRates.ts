'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateTaxRatesInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useUpdateTaxRates() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.config.updateTaxRates.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.config.get.queryFilter()),
      onError,
    }),
  );

  return {
    updateTaxRates: (data: UpdateTaxRatesInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}
