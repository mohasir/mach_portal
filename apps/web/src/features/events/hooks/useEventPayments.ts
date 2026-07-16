'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UpdateEventPaymentInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useUpdateEventPayment() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const { message } = App.useApp();
  const { t } = useTranslation('events');

  const mutation = useMutation(
    trpc.events.updatePayment.mutationOptions({
      onSuccess: () => {
        message.success(t('detail.payments.saved'));
        return qc.invalidateQueries(trpc.events.pathFilter());
      },
      onError,
    }),
  );

  return {
    updatePayment: (id: string, data: UpdateEventPaymentInput) =>
      mutation.mutateAsync({ id, data }),
    isPending: mutation.isPending,
  };
}

export function useMarkEventCompleted() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const { message } = App.useApp();
  const { t } = useTranslation('events');

  const mutation = useMutation(
    trpc.events.markCompleted.mutationOptions({
      onSuccess: () => {
        message.success(t('detail.markCompletedSuccess'));
        return qc.invalidateQueries(trpc.events.pathFilter());
      },
      onError,
    }),
  );

  return {
    markCompleted: (id: string) => mutation.mutateAsync({ id }),
    isPending: mutation.isPending,
  };
}
