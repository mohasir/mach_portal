'use client';
import { useState } from 'react';
import { App, Segmented, Skeleton } from 'antd';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { canTransition, QUOTE_STAGE, type QuoteStageId } from '@repo/schemas';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useQuoteStages } from '@/features/settings';
import { usePipelineBoard, usePipelineTransitions } from '../../hooks/usePipelineBoard';
import type { QuoteCard as QuoteCardType } from '../../types';
import { PipelineColumn } from './PipelineColumn';
import { QuoteCardPreview } from './QuoteCardPreview';

const CONFIRM_STAGES: QuoteStageId[] = [QUOTE_STAGE.CONFIRMED, QUOTE_STAGE.CANCELLED];

const CONFIRM_STAGE_KEYS: Partial<Record<QuoteStageId, string>> = {
  [QUOTE_STAGE.CONFIRMED]: 'confirmed',
  [QUOTE_STAGE.CANCELLED]: 'cancelled',
};

export function PipelineBoard() {
  const { t } = useTranslation('quotes');
  const { modal } = App.useApp();
  const isDesktop = useIsDesktop();
  const { orderedIds, stageMap } = useQuoteStages();
  const [mobileStage, setMobileStage] = useState<QuoteStageId>(QUOTE_STAGE.PENDING);
  const [activeCard, setActiveCard] = useState<QuoteCardType | null>(null);
  const boardQuery = {};
  const { data, isLoading } = usePipelineBoard(boardQuery);
  const { moveStage, approve, cancel } = usePipelineTransitions(boardQuery);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const commitTransition = (id: string, to: QuoteStageId) => {
    if (to === QUOTE_STAGE.CONFIRMED) return approve(id);
    if (to === QUOTE_STAGE.CANCELLED) return cancel(id);
    return moveStage(id, to);
  };

  const runTransition = (id: string, from: QuoteStageId, to: QuoteStageId) => {
    if (!canTransition(from, to)) return;

    if (CONFIRM_STAGES.includes(to)) {
      const stageKey = CONFIRM_STAGE_KEYS[to];
      modal.confirm({
        title: t(`pipeline.confirm.${stageKey}.title`),
        content: t(`pipeline.confirm.${stageKey}.content`),
        okText: t(`pipeline.confirm.${stageKey}.ok`),
        okButtonProps: to === QUOTE_STAGE.CANCELLED ? { danger: true } : undefined,
        onOk: () => commitTransition(id, to),
      });
    } else {
      void commitTransition(id, to);
    }
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const dragged = active.data.current as { card: QuoteCardType } | undefined;
    setActiveCard(dragged?.card ?? null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveCard(null);
    if (!over) return;
    const dragged = active.data.current as { card: QuoteCardType } | undefined;
    if (!dragged) return;
    const toStage = over.id as QuoteStageId;
    const fromStage = dragged.card.stageId as QuoteStageId;
    if (fromStage === toStage) return;
    runTransition(dragged.card.id, fromStage, toStage);
  };

  return (
    <div className="h-full min-h-0">
      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {orderedIds.map((stageId) => (
            <Skeleton key={stageId} active paragraph={{ rows: 4 }} />
          ))}
        </div>
      ) : isDesktop ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveCard(null)}
        >
          <div className="grid h-full auto-rows-fr grid-cols-1 gap-4 lg:grid-cols-4">
            {orderedIds.map((stageId) => (
              <PipelineColumn
                key={stageId}
                stageId={stageId}
                cards={data[stageId]}
                onMove={runTransition}
              />
            ))}
          </div>
          <DragOverlay>{activeCard ? <QuoteCardPreview card={activeCard} /> : null}</DragOverlay>
        </DndContext>
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-4">
          <div className="overflow-x-auto pb-1">
            <Segmented
              value={mobileStage}
              onChange={(value) => setMobileStage(value as QuoteStageId)}
              options={orderedIds.map((id) => ({ value: id, label: stageMap.get(id)?.label }))}
            />
          </div>
          <div className="min-h-0 flex-1">
            <PipelineColumn
              stageId={mobileStage}
              cards={data[mobileStage]}
              onMove={runTransition}
              draggable={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
