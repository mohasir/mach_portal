import { useMutation } from '@tanstack/react-query';
import type { SetConsoleCatalogKindInput } from '@repo/schemas';
import { useApiError } from '@/lib/error/useApiError';
import { useTRPC } from '@/lib/trpc/client';
import { useInvalidateConsole } from './useInvalidateConsole';

export function useSetCatalogKind() {
  const trpc = useTRPC();
  const invalidate = useInvalidateConsole();
  const onError = useApiError();
  const mutation = useMutation(
    trpc.console.catalog.setKind.mutationOptions({ onSuccess: invalidate, onError }),
  );
  return {
    setCatalogKind: (input: SetConsoleCatalogKindInput) => mutation.mutateAsync(input),
    isPending: mutation.isPending,
  };
}
