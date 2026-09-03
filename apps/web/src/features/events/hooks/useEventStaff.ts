'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import type { AssignStaffInput, RemoveStaffInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useAssignStaff() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const { message } = App.useApp();
  const { t } = useTranslation('events');

  const mutation = useMutation(
    trpc.events.assignStaff.mutationOptions({
      onSuccess: () => {
        message.success(t('assignStaff.success'));
        return Promise.all([
          qc.invalidateQueries(trpc.events.pathFilter()),
          qc.invalidateQueries(trpc.quotes.pathFilter()),
          qc.invalidateQueries(trpc.staff.pathFilter()),
        ]);
      },
      onError,
    }),
  );

  return {
    assignStaff: (data: AssignStaffInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}

export function useRemoveStaff() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.events.removeStaff.mutationOptions({
      onSuccess: () =>
        Promise.all([
          qc.invalidateQueries(trpc.events.pathFilter()),
          qc.invalidateQueries(trpc.quotes.pathFilter()),
          qc.invalidateQueries(trpc.staff.pathFilter()),
        ]),
      onError,
    }),
  );

  return {
    removeStaff: (data: RemoveStaffInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}
