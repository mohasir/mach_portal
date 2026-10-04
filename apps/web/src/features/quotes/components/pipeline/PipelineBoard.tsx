'use client';
import { useEffect } from 'react';
import { Skeleton } from 'antd';
import { QUOTE_STAGE, type QuoteStageId, type QuotesFilters } from '@repo/schemas';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useQuoteStages } from '@/features/settings';
import { usePipelineBoard, usePipelineTransitions } from '../../hooks/usePipelineBoard';
import { useQuoteStageGuard } from '../../hooks/useQuoteStageGuard';
import { countActiveFilters } from '../../helpers';
import { PipelineBoardDesktop } from './PipelineBoardDesktop';
import { PipelineBoardMobile } from './PipelineBoardMobile';

interface PipelineBoardProps {
  filters: QuotesFilters;
  /** True while the previous board is still shown for a new search/filter. */
  onSearchingChange?: (searching: boolean) => void;
  /** Cards currently on the board, across every column. */
  onTotalChange?: (total: number | undefined) => void;
}

export function PipelineBoard({ filters, onSearchingChange, onTotalChange }: PipelineBoardProps) {
  const isDesktop = useIsDesktop();
  const { guardTransition, confirmContextHolder } = useQuoteStageGuard();
  const { orderedIds } = useQuoteStages();
  const boardQuery = filters;
  const { data, isLoading, isPlaceholderData } = usePipelineBoard(boardQuery);
  const { moveStage, approve, cancel } = usePipelineTransitions(boardQuery);

  // A search/filter narrowed the whole board down to one quote: point it out.
  const isFiltered = !!filters.search || countActiveFilters(filters) > 0;
  const results = data && !isPlaceholderData ? orderedIds.flatMap((id) => data[id]) : [];
  const highlightedId = isFiltered && results.length === 1 ? results[0]?.id : undefined;

  useEffect(() => {
    onSearchingChange?.(isPlaceholderData);
    return () => onSearchingChange?.(false);
  }, [isPlaceholderData, onSearchingChange]);

  const total = data ? orderedIds.reduce((sum, id) => sum + data[id].length, 0) : undefined;
  useEffect(() => {
    onTotalChange?.(total);
    return () => onTotalChange?.(undefined);
  }, [total, onTotalChange]);

  const commitTransition = (id: string, to: QuoteStageId) => {
    if (to === QUOTE_STAGE.CONFIRMED) return approve(id);
    if (to === QUOTE_STAGE.CANCELLED) return cancel(id);
    return moveStage(id, to);
  };

  const runTransition = (id: string, from: QuoteStageId, to: QuoteStageId, isDraft: boolean) =>
    guardTransition(from, to, isDraft, () => commitTransition(id, to));

  return (
    <div className="h-full min-h-0">
      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {orderedIds.map((stageId) => (
            <Skeleton key={stageId} active paragraph={{ rows: 4 }} />
          ))}
        </div>
      ) : isDesktop ? (
        <PipelineBoardDesktop
          data={data}
          orderedIds={orderedIds}
          highlightedId={highlightedId}
          onMove={runTransition}
        />
      ) : (
        <PipelineBoardMobile
          data={data}
          orderedIds={orderedIds}
          highlightedId={highlightedId}
          resultsKey={isPlaceholderData ? undefined : JSON.stringify(boardQuery)}
        />
      )}
      {confirmContextHolder}
    </div>
  );
}
