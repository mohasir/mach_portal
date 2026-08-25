'use client';
import { Skeleton } from 'antd';
import { QUOTE_STAGE, type QuoteStageId } from '@repo/schemas';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useQuoteStages } from '@/features/settings';
import { usePipelineBoard, usePipelineTransitions } from '../../hooks/usePipelineBoard';
import { useQuoteStageGuard } from '../../hooks/useQuoteStageGuard';
import { PipelineBoardDesktop } from './PipelineBoardDesktop';
import { PipelineBoardMobile } from './PipelineBoardMobile';

export function PipelineBoard() {
  const isDesktop = useIsDesktop();
  const { guardTransition, confirmContextHolder } = useQuoteStageGuard();
  const { orderedIds } = useQuoteStages();
  const boardQuery = {};
  const { data, isLoading } = usePipelineBoard(boardQuery);
  const { moveStage, approve, cancel } = usePipelineTransitions(boardQuery);

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
        <PipelineBoardDesktop data={data} orderedIds={orderedIds} onMove={runTransition} />
      ) : (
        <PipelineBoardMobile data={data} orderedIds={orderedIds} />
      )}
      {confirmContextHolder}
    </div>
  );
}
