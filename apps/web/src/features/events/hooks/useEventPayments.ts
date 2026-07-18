'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import type { RegisterEventPaymentInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useRegisterEventPayment() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const { message } = App.useApp();
  const { t } = useTranslation('events');

  const mutation = useMutation(
    trpc.events.registerPayment.mutationOptions({
      onSuccess: () => {
        message.success(t('detail.payments.registered'));
        return qc.invalidateQueries(trpc.events.pathFilter());
      },
      onError,
    }),
  );

  return {
    registerPayment: (id: string, data: RegisterEventPaymentInput) =>
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
