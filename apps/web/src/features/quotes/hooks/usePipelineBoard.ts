'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  QUOTE_STAGE,
  QUOTE_STAGE_IDS,
  type QuoteStageId,
  type QuotesBoardQuery,
} from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';
import type { QuoteBoard } from '../types';

function moveCard(board: QuoteBoard, id: string, toStage: QuoteStageId): QuoteBoard {
  const next: QuoteBoard = {
    [QUOTE_STAGE.PENDING]: [...board[QUOTE_STAGE.PENDING]],
    [QUOTE_STAGE.QUOTED]: [...board[QUOTE_STAGE.QUOTED]],
    [QUOTE_STAGE.CONFIRMED]: [...board[QUOTE_STAGE.CONFIRMED]],
    [QUOTE_STAGE.CANCELLED]: [...board[QUOTE_STAGE.CANCELLED]],
  };

  for (const stageId of QUOTE_STAGE_IDS) {
    const index = next[stageId].findIndex((card) => card.id === id);
    if (index === -1) continue;
    const card = next[stageId][index];
    if (!card) break;
    next[stageId].splice(index, 1);
    next[toStage] = [{ ...card, stageId: toStage }, ...next[toStage]];
    break;
  }
  return next;
}

export function usePipelineBoard(query: QuotesBoardQuery) {
  const trpc = useTRPC();
  return useQuery(trpc.quotes.board.queryOptions(query));
}

/** `updateStage`/`approve`/`cancel` with an optimistic move on the board cache (mach-bar-flows.md §3.3). */
export function usePipelineTransitions(boardQuery: QuotesBoardQuery) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const { message } = App.useApp();
  const { t } = useTranslation('quotes');
  const queryKey = trpc.quotes.board.queryKey(boardQuery);

  // Snapshot for rollback, stashed as a closure var instead of mutation `context` — the tRPC
  // tanstack-query `mutationOptions()` helper doesn't thread a custom TContext through onMutate.
  let previousSnapshot: QuoteBoard | undefined;

  const applyOptimistic = async (id: string, toStage: QuoteStageId) => {
    await qc.cancelQueries({ queryKey });
    previousSnapshot = qc.getQueryData<QuoteBoard>(queryKey);
    if (previousSnapshot) qc.setQueryData(queryKey, moveCard(previousSnapshot, id, toStage));
  };

  const rollback = (error: unknown) => {
    if (previousSnapshot) qc.setQueryData(queryKey, previousSnapshot);
    onError(error);
  };

  const settle = () => qc.invalidateQueries(trpc.quotes.pathFilter());

  const updateStage = useMutation(
    trpc.quotes.updateStage.mutationOptions({
      onMutate: ({ id, stageId }) => applyOptimistic(id, stageId),
      onSuccess: () => message.success(t('pipeline.moveSuccess')),
      onError: rollback,
      onSettled: settle,
    }),
  );

  const approve = useMutation(
    trpc.quotes.approve.mutationOptions({
      onMutate: ({ id }) => applyOptimistic(id, QUOTE_STAGE.CONFIRMED),
      onSuccess: () => message.success(t('pipeline.moveSuccess')),
      onError: rollback,
      onSettled: settle,
    }),
  );

  const cancel = useMutation(
    trpc.quotes.cancel.mutationOptions({
      onMutate: ({ id }) => applyOptimistic(id, QUOTE_STAGE.CANCELLED),
      onSuccess: () => message.success(t('pipeline.moveSuccess')),
      onError: rollback,
      onSettled: settle,
    }),
  );

  return {
    moveStage: (id: string, stageId: QuoteStageId) => updateStage.mutateAsync({ id, stageId }),
    approve: (id: string) => approve.mutateAsync({ id }),
    cancel: (id: string) => cancel.mutateAsync({ id }),
  };
}
