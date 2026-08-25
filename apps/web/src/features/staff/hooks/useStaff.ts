import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateStaffInput, StaffListQuery, UpdateStaffInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useStaffList(query: StaffListQuery) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.staff.list.queryOptions(query), placeholderData: keepPreviousData });
}

export function useStaffAvailability(date: string | undefined) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.staff.getAvailability.queryOptions({ date: date! }), enabled: !!date });
}

export function useCreateStaff() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.staff.create.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.staff.list.queryFilter()),
      onError,
    }),
  );

  return {
    createStaff: (data: CreateStaffInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}

export function useUpdateStaff() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.staff.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.staff.list.queryFilter()),
      onError,
    }),
  );

  return {
    updateStaff: (id: string, data: UpdateStaffInput) => mutation.mutateAsync({ id, data }),
    isPending: mutation.isPending,
  };
}

export function useDeleteStaff() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.staff.delete.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.staff.list.queryFilter()),
      onError,
    }),
  );

  return {
    deleteStaff: (id: string) => mutation.mutateAsync({ id }),
    isPending: mutation.isPending,
  };
}
