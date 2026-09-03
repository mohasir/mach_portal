'use client';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import type {
  AssignQuoteInput,
  CreateQuoteInput,
  QuoteStageId,
  QuotesListQuery,
  UpdateQuoteInput,
} from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useQuotesList(query: QuotesListQuery) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.quotes.list.queryOptions(query), placeholderData: keepPreviousData });
}

export function useQuote(id: string | undefined) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.quotes.getById.queryOptions({ id: id! }), enabled: !!id });
}

// Advisory only (see quotes.router.ts checkAvailability) — never blocks the builder, just
// feeds the green-check/warning UI once both eventDate and eventTime are filled in.
export function useQuoteAvailability(
  eventDate: string | undefined,
  eventTime: string | undefined,
  excludeQuoteId: string | undefined,
) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.quotes.checkAvailability.queryOptions({
      eventDate: eventDate!,
      eventTime: eventTime!,
      excludeQuoteId,
    }),
    enabled: !!eventDate && !!eventTime,
  });
}

// create/update don't wire onError here — the client (and quote) fields it can fail on live
// across two components (ClientSection, EventSection), so QuoteBuilderContent owns routing the
// error to the right one instead of a single generic toast.
export function useCreateQuote() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const mutation = useMutation(
    trpc.quotes.create.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.quotes.pathFilter()),
    }),
  );
  return {
    createQuote: (data: CreateQuoteInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}

export function useUpdateQuote() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const mutation = useMutation(
    trpc.quotes.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.quotes.pathFilter()),
    }),
  );
  return {
    updateQuote: (id: string, data: UpdateQuoteInput) => mutation.mutateAsync({ id, data }),
    isPending: mutation.isPending,
  };
}

export function useUpdateQuoteStage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const { message } = App.useApp();
  const { t } = useTranslation('quotes');
  const mutation = useMutation(
    trpc.quotes.updateStage.mutationOptions({
      onSuccess: () => {
        message.success(t('pipeline.moveSuccess'));
        return qc.invalidateQueries(trpc.quotes.pathFilter());
      },
      onError,
    }),
  );
  return {
    updateStage: (id: string, stageId: QuoteStageId) => mutation.mutateAsync({ id, stageId }),
    isPending: mutation.isPending,
  };
}

export function useApproveQuote() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const { message } = App.useApp();
  const { t } = useTranslation('quotes');
  const mutation = useMutation(
    trpc.quotes.approve.mutationOptions({
      onSuccess: () => {
        message.success(t('pipeline.moveSuccess'));
        return qc.invalidateQueries(trpc.quotes.pathFilter());
      },
      onError,
    }),
  );
  return {
    approveQuote: (id: string) => mutation.mutateAsync({ id }),
    isPending: mutation.isPending,
  };
}

export function useCancelQuote() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const { message } = App.useApp();
  const { t } = useTranslation('quotes');
  const mutation = useMutation(
    trpc.quotes.cancel.mutationOptions({
      onSuccess: () => {
        message.success(t('pipeline.moveSuccess'));
        return Promise.all([
          qc.invalidateQueries(trpc.quotes.pathFilter()),
          qc.invalidateQueries(trpc.events.pathFilter()),
        ]);
      },
      onError,
    }),
  );
  return {
    cancelQuote: (id: string) => mutation.mutateAsync({ id }),
    isPending: mutation.isPending,
  };
}

export function useGenerateQuotePdf() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const mutation = useMutation(
    trpc.quotes.generatePdf.mutationOptions({
      onSuccess: (data) => {
        qc.invalidateQueries(trpc.quotes.pathFilter());
        if (data.pdfUrl) window.open(data.pdfUrl, '_blank');
      },
      onError,
    }),
  );
  return {
    generatePdf: (id: string) => mutation.mutateAsync({ id }),
    isPending: mutation.isPending,
  };
}

export function useAssignQuote() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const { message } = App.useApp();
  const { t } = useTranslation('quotes');
  const mutation = useMutation(
    trpc.quotes.assign.mutationOptions({
      onSuccess: (_data, variables) => {
        message.success(
          variables.assignedToId
            ? t('pipeline.assignQuote.success')
            : t('pipeline.assignQuote.unassignSuccess'),
        );
        return qc.invalidateQueries(trpc.quotes.pathFilter());
      },
      onError,
    }),
  );
  return {
    assignQuote: (data: AssignQuoteInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}

export function useArchiveQuote() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const mutation = useMutation(
    trpc.quotes.archive.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.quotes.pathFilter()),
      onError,
    }),
  );
  return {
    archiveQuote: (id: string) => mutation.mutateAsync({ id }),
    isPending: mutation.isPending,
  };
}
