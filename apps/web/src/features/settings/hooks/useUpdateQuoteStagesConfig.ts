'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UpdateQuoteStagesInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useUpdateQuoteStagesConfig() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const { message } = App.useApp();
  const { t } = useTranslation('settings');

  const mutation = useMutation(
    trpc.config.updateQuoteStages.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries(trpc.config.get.queryFilter());
        message.success(t('saveSuccess'));
      },
      onError,
    }),
  );

  return {
    updateQuoteStages: (data: UpdateQuoteStagesInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}
