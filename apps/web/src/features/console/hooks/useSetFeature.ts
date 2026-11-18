import { useMutation } from '@tanstack/react-query';
import type { SetConsoleFeatureInput } from '@repo/schemas';
import { useApiError } from '@/lib/error/useApiError';
import { useTRPC } from '@/lib/trpc/client';
import { isDependencyErrorCode } from '../helpers';
import { getApiErrorCode } from '@/lib/error/apiErrorCode';
import { useInvalidateConsole } from './useInvalidateConsole';

/** Dependency conflicts are shown inline by the caller, next to the switch or form. */
export function useFeatureErrorReporter() {
  const reportError = useApiError();
  return (error: unknown) => {
    if (isDependencyErrorCode(getApiErrorCode(error))) return;
    reportError(error);
  };
}

export function useSetFeature() {
  const trpc = useTRPC();
  const invalidate = useInvalidateConsole();
  const onError = useFeatureErrorReporter();
  const mutation = useMutation(
    trpc.console.features.set.mutationOptions({ onSuccess: invalidate, onError }),
  );
  return {
    setFeature: (input: SetConsoleFeatureInput) => mutation.mutateAsync(input),
    isPending: mutation.isPending,
  };
}
