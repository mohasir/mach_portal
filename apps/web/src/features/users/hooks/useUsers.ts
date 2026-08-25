import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserInput, UpdateUserInput, UsersListQuery } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useUsersList(query: UsersListQuery) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.users.list.queryOptions(query), placeholderData: keepPreviousData });
}

export function useCreateUser() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.users.create.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.users.list.queryFilter()),
      onError,
    }),
  );

  return {
    createUser: (data: CreateUserInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}

export function useUpdateUser() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.users.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.users.list.queryFilter()),
      onError,
    }),
  );

  return {
    updateUser: (id: string, data: UpdateUserInput) => mutation.mutateAsync({ id, data }),
    isPending: mutation.isPending,
  };
}

export function useDeleteUser() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.users.delete.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.users.list.queryFilter()),
      onError,
    }),
  );

  return {
    deleteUser: (id: string) => mutation.mutateAsync({ id }),
    isPending: mutation.isPending,
  };
}
