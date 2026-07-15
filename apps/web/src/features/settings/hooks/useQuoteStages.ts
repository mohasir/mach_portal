import { useMemo } from 'react';
import type { QuoteStageId } from '@repo/schemas';
import { useConfig } from './useConfig';

export interface QuoteStageInfo {
  label: string;
  color: string;
  description: string | null;
  sortOrder: number;
}

export function useQuoteStages() {
  const { data, isLoading } = useConfig();
  const stages = data?.quoteStages ?? [];

  const stageMap = useMemo(() => {
    const map = new Map<QuoteStageId, QuoteStageInfo>();
    for (const s of stages) {
      map.set(s.id as QuoteStageId, {
        label: s.label,
        color: s.color,
        description: s.description,
        sortOrder: s.sortOrder,
      });
    }
    return map;
  }, [stages]);

  const orderedIds = useMemo(
    () => [...stages].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.id as QuoteStageId),
    [stages],
  );

  return { stages, stageMap, orderedIds, isLoading };
}
