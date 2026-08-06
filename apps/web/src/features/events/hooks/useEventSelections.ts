'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UpdateEventSelectionsInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useUpdateEventSelections() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const { message } = App.useApp();
  const { t } = useTranslation('events');

  const mutation = useMutation(
    trpc.events.updateSelections.mutationOptions({
      onSuccess: () => {
        message.success(t('detail.selections.saveSuccess'));
        return Promise.all([
          qc.invalidateQueries(trpc.events.pathFilter()),
          qc.invalidateQueries(trpc.quotes.pathFilter()),
        ]);
      },
      onError,
    }),
  );

  return {
    updateSelections: (data: UpdateEventSelectionsInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}
