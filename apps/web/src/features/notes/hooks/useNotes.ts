import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateNoteInput, UpdateNoteInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useNotesList() {
  const trpc = useTRPC();
  return useQuery(trpc.notes.list.queryOptions());
}

export function useCreateNote() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.notes.create.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.notes.list.queryFilter()),
      onError,
    }),
  );

  return { createNote: (data: CreateNoteInput) => mutation.mutateAsync(data), isPending: mutation.isPending };
}

export function useUpdateNote() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.notes.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.notes.list.queryFilter()),
      onError,
    }),
  );

  return {
    updateNote: (id: string, data: UpdateNoteInput) => mutation.mutateAsync({ id, data }),
    isPending: mutation.isPending,
  };
}

export function useDeleteNote() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.notes.delete.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.notes.list.queryFilter()),
      onError,
    }),
  );

  return { deleteNote: (id: string) => mutation.mutateAsync({ id }), isPending: mutation.isPending };
}
