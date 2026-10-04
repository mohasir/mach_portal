'use client';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { QuoteStageId } from '@repo/schemas';
import type { QuoteBoard } from '../../types';
import { usePipelineScrollStore } from '../../pipelineScroll.store';
import { PipelineColumn } from './PipelineColumn';

interface PipelineBoardMobileProps {
  data: QuoteBoard;
  orderedIds: QuoteStageId[];
  highlightedId?: string;
  /** Identifies the filters `data` belongs to; undefined while stale results are still shown. */
  resultsKey?: string;
}

export function PipelineBoardMobile({
  data,
  orderedIds,
  highlightedId,
  resultsKey,
}: PipelineBoardMobileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrolledForKey = useRef(resultsKey);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container) container.scrollLeft = usePipelineScrollStore.getState().mobileScrollLeft;
  }, []);

  // Only one column fits on screen here, so once a new search/filter resolves, bring the first
  // column with results into view. Skipped on mount to keep the restored scroll position.
  useEffect(() => {
    if (!resultsKey || scrolledForKey.current === resultsKey) return;
    scrolledForKey.current = resultsKey;
    const index = orderedIds.findIndex((stageId) => data[stageId].length > 0);
    const column = index >= 0 ? containerRef.current?.children[index] : undefined;
    column?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [resultsKey, data, orderedIds]);

  return (
    <div
      ref={containerRef}
      onScroll={(e) =>
        usePipelineScrollStore.getState().setMobileScrollLeft(e.currentTarget.scrollLeft)
      }
      className="-mx-4 flex h-full min-h-0 snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2"
    >
      {orderedIds.map((stageId) => (
        <div key={stageId} className="w-[85%] max-w-80 shrink-0 snap-center">
          <PipelineColumn
            stageId={stageId}
            cards={data[stageId]}
            highlightedId={highlightedId}
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}
