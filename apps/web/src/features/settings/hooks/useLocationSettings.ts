'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateLocationSettingsInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useLocationSettings() {
  const trpc = useTRPC();
  return useQuery(trpc.locationSettings.get.queryOptions());
}

export function useUpdateLocationSettings() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.locationSettings.update.mutationOptions({
      // Quote completeness (isComplete) follows these settings, so cached quotes go stale too.
      onSuccess: async () => {
        await Promise.all([
          qc.invalidateQueries(trpc.locationSettings.get.queryFilter()),
          qc.invalidateQueries(trpc.quotes.pathFilter()),
        ]);
      },
      onError,
    }),
  );

  return {
    updateLocationSettings: (data: UpdateLocationSettingsInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}
