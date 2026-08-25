'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import type { RegisterEventPaymentInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError, reportApiErrorCode } from '@/lib/error/useApiError';

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

export function useUploadEventPaymentAttachment() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { t } = useTranslation('events');
  const { t: tApi } = useTranslation('api');

  return {
    // The file never touches tRPC's JSON contract — AntD's own uploader POSTs
    // it straight to this Express route, which gives real per-file upload
    // progress (percent, time left) for free; fetch() can't report that.
    uploadUrl: (paymentId: string) => `/api/uploads/event-payments/${paymentId}/attachments`,
    onUploaded: () => {
      message.success(t('detail.payments.attachments.uploaded'));
      void qc.invalidateQueries(trpc.events.pathFilter());
    },
    onUploadError: (errorCode: string | undefined) => reportApiErrorCode(errorCode, tApi, message),
  };
}

export function useRemoveEventPaymentAttachment() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const { message } = App.useApp();
  const { t } = useTranslation('events');

  const mutation = useMutation(
    trpc.events.removePaymentAttachment.mutationOptions({
      onSuccess: () => {
        message.success(t('detail.payments.attachments.removed'));
        return qc.invalidateQueries(trpc.events.pathFilter());
      },
      onError,
    }),
  );

  return {
    removeAttachment: (eventId: string, attachmentId: string) =>
      mutation.mutateAsync({ eventId, attachmentId }),
    isPending: mutation.isPending,
  };
}
