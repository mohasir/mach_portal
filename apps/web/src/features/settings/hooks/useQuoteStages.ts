import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { QUOTE_STAGE, type QuoteStageId } from '@repo/schemas';
import { useConfig } from './useConfig';

export interface QuoteStageInfo {
  label: string;
  color: string;
  description: string | null;
  sortOrder: number;
}

const STAGE_LABEL_KEYS: Record<QuoteStageId, string> = {
  [QUOTE_STAGE.PENDING]: 'stages.pending',
  [QUOTE_STAGE.QUOTED]: 'stages.quoted',
  [QUOTE_STAGE.CONFIRMED]: 'stages.confirmed',
  [QUOTE_STAGE.CANCELLED]: 'stages.cancelled',
};

export function useQuoteStages() {
  const { t } = useTranslation('quotes');
  const { data, isLoading } = useConfig();
  const stages = data?.quoteStages ?? [];

  const stageMap = useMemo(() => {
    const map = new Map<QuoteStageId, QuoteStageInfo>();
    for (const s of stages) {
      const id = s.id as QuoteStageId;
      map.set(id, {
        label: t(STAGE_LABEL_KEYS[id]),
        color: s.color,
        description: s.description,
        sortOrder: s.sortOrder,
      });
    }
    return map;
  }, [stages, t]);

  const orderedIds = useMemo(
    () => [...stages].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.id as QuoteStageId),
    [stages],
  );

  return { stages, stageMap, orderedIds, isLoading };
}
