import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateNoteInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';

export function useNotesList() {
  const trpc = useTRPC();
  return useQuery(trpc.notes.list.queryOptions());
}

export function useCreateNote() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const mutation = useMutation(
    trpc.notes.create.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.notes.list.queryFilter()),
    }),
  );

  return {
    createNote: (data: CreateNoteInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}
