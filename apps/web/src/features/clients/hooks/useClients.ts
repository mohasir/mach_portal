import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormInstance } from 'antd';
import type { ClientsListQuery, CreateClientInput, UpdateClientInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useClientsList(query: ClientsListQuery) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.clients.list.queryOptions(query), placeholderData: keepPreviousData });
}

export function useCreateClient(form?: FormInstance) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError(form);

  const mutation = useMutation(
    trpc.clients.create.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.clients.list.queryFilter()),
      onError,
    }),
  );

  return {
    createClient: (data: CreateClientInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}

export function useUpdateClient(form?: FormInstance) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError(form);

  const mutation = useMutation(
    trpc.clients.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.clients.pathFilter()),
      onError,
    }),
  );

  return {
    updateClient: (id: string, data: UpdateClientInput) => mutation.mutateAsync({ id, data }),
    isPending: mutation.isPending,
  };
}

export function useClient(id: string | undefined) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.clients.getById.queryOptions({ id: id! }), enabled: !!id });
}

export function useDeleteClient() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.clients.delete.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.clients.list.queryFilter()),
      onError,
    }),
  );

  return {
    deleteClient: (id: string) => mutation.mutateAsync({ id }),
    isPending: mutation.isPending,
  };
}
