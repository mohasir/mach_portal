import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateConfigInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useUpdateConfig() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.config.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.config.get.queryFilter()),
      onError,
    }),
  );

  return {
    updateConfig: (data: UpdateConfigInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}
