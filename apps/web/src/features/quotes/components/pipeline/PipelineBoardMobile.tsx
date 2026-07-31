'use client';
import type { QuoteStageId } from '@repo/schemas';
import type { QuoteBoard } from '../../types';
import { PipelineColumn } from './PipelineColumn';

interface PipelineBoardMobileProps {
  data: QuoteBoard;
  orderedIds: QuoteStageId[];
}

export function PipelineBoardMobile({ data, orderedIds }: PipelineBoardMobileProps) {
  return (
    <div className="-mx-4 flex h-full min-h-0 snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2">
      {orderedIds.map((stageId) => (
        <div key={stageId} className="w-[85%] max-w-80 shrink-0 snap-center">
          <PipelineColumn stageId={stageId} cards={data[stageId]} draggable={false} />
        </div>
      ))}
    </div>
  );
}
