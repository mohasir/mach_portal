'use client';
import { useLayoutEffect, useRef } from 'react';
import type { QuoteStageId } from '@repo/schemas';
import type { QuoteBoard } from '../../types';
import { usePipelineScrollStore } from '../../pipelineScroll.store';
import { PipelineColumn } from './PipelineColumn';

interface PipelineBoardMobileProps {
  data: QuoteBoard;
  orderedIds: QuoteStageId[];
}

export function PipelineBoardMobile({ data, orderedIds }: PipelineBoardMobileProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container) container.scrollLeft = usePipelineScrollStore.getState().mobileScrollLeft;
  }, []);

  return (
    <div
      ref={containerRef}
      onScroll={(e) => usePipelineScrollStore.getState().setMobileScrollLeft(e.currentTarget.scrollLeft)}
      className="-mx-4 flex h-full min-h-0 snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2"
    >
      {orderedIds.map((stageId) => (
        <div key={stageId} className="w-[85%] max-w-80 shrink-0 snap-center">
          <PipelineColumn stageId={stageId} cards={data[stageId]} draggable={false} />
        </div>
      ))}
    </div>
  );
}
