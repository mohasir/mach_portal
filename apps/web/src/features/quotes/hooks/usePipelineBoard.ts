import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QuoteStage, QuotesBoardQuery } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';
import type { QuoteBoard } from '../types';

const STAGES: QuoteStage[] = ['new', 'quoted', 'confirmed', 'completed', 'cancelled'];

function moveCard(board: QuoteBoard, id: string, toStage: QuoteStage): QuoteBoard {
  const next: QuoteBoard = {
    new: [...board.new],
    quoted: [...board.quoted],
    confirmed: [...board.confirmed],
    completed: [...board.completed],
    cancelled: [...board.cancelled],
  };

  for (const stage of STAGES) {
    const index = next[stage].findIndex((card) => card.id === id);
    if (index === -1) continue;
    const card = next[stage][index];
    if (!card) break;
    next[stage].splice(index, 1);
    next[toStage] = [{ ...card, stage: toStage }, ...next[toStage]];
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
  const queryKey = trpc.quotes.board.queryKey(boardQuery);

  // Snapshot for rollback, stashed as a closure var instead of mutation `context` — the tRPC
  // tanstack-query `mutationOptions()` helper doesn't thread a custom TContext through onMutate.
  let previousSnapshot: QuoteBoard | undefined;

  const applyOptimistic = async (id: string, toStage: QuoteStage) => {
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
      onMutate: ({ id, stage }) => applyOptimistic(id, stage),
      onError: rollback,
      onSettled: settle,
    }),
  );

  const approve = useMutation(
    trpc.quotes.approve.mutationOptions({
      onMutate: ({ id }) => applyOptimistic(id, 'confirmed'),
      onError: rollback,
      onSettled: settle,
    }),
  );

  const cancel = useMutation(
    trpc.quotes.cancel.mutationOptions({
      onMutate: ({ id }) => applyOptimistic(id, 'cancelled'),
      onError: rollback,
      onSettled: settle,
    }),
  );

  return {
    moveStage: (id: string, stage: QuoteStage) => updateStage.mutateAsync({ id, stage }),
    approve: (id: string) => approve.mutateAsync({ id }),
    cancel: (id: string) => cancel.mutateAsync({ id }),
  };
}
