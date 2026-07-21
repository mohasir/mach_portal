'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import type { QuotePdfTemplateContent } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useUpdateQuotePdfTemplate() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const { message } = App.useApp();
  const { t } = useTranslation('settings');

  const mutation = useMutation(
    trpc.templates.updateQuotePdf.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries(trpc.templates.getQuotePdf.queryFilter());
        message.success(t('saveSuccess'));
      },
      onError,
    }),
  );

  return {
    updateQuotePdfTemplate: (content: QuotePdfTemplateContent) => mutation.mutateAsync({ content }),
    isPending: mutation.isPending,
  };
}
