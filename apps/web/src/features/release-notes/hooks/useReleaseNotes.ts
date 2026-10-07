import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc/client';

// No onError on purpose: if saving fails, the notes simply show again on the next load, which
// beats interrupting the user with an error toast for something they just dismissed.
export function useMarkReleaseNotesSeen() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const mutation = useMutation(
    trpc.userPreferences.update.mutationOptions({
      onSuccess: (data) => qc.setQueryData(trpc.userPreferences.get.queryKey(), data),
    }),
  );
  return (version: string) => mutation.mutate({ lastSeenReleaseNotes: version });
}

// The settings hook never refetches (staleTime: Infinity). Right after an in-tab login the
// preferences may already be cached when the panel mounts, so the gate would never see a fetch
// of its own; forcing one on mount gives it fresh data to decide with.
export function useReleaseNotesPreferences(enabled: boolean) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.userPreferences.get.queryOptions(),
    staleTime: Infinity,
    refetchOnMount: 'always',
    enabled,
  });
}
