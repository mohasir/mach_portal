'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateTaxPreferencesInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useUpdateTaxPreferences() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.config.updateTaxPreferences.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.config.get.queryFilter()),
      onError,
    }),
  );

  return {
    updateTaxPreferences: (data: UpdateTaxPreferencesInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}
