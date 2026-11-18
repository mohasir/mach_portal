import { useMutation } from '@tanstack/react-query';
import type { UnsetConsoleFeatureInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useInvalidateConsole } from './useInvalidateConsole';
import { useFeatureErrorReporter } from './useSetFeature';

export function useUnsetFeature() {
  const trpc = useTRPC();
  const invalidate = useInvalidateConsole();
  const onError = useFeatureErrorReporter();
  const mutation = useMutation(
    trpc.console.features.unset.mutationOptions({ onSuccess: invalidate, onError }),
  );
  return {
    unsetFeature: (input: UnsetConsoleFeatureInput) => mutation.mutateAsync(input),
    isPending: mutation.isPending,
  };
}
