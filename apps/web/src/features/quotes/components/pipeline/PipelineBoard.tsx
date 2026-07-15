'use client';
import { useState } from 'react';
import { App, Segmented, Skeleton } from 'antd';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { canTransition, QUOTE_STAGE, type QuoteStageId } from '@repo/schemas';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useQuoteStages } from '@/features/settings';
import { usePipelineBoard, usePipelineTransitions } from '../../hooks/usePipelineBoard';
import type { QuoteCard as QuoteCardType } from '../../types';
import { PipelineColumn } from './PipelineColumn';

const CONFIRM_STAGES: QuoteStageId[] = [QUOTE_STAGE.CONFIRMED, QUOTE_STAGE.CANCELLED];

export function PipelineBoard() {
  const { t } = useTranslation('quotes');
  const { modal } = App.useApp();
  const isDesktop = useIsDesktop();
  const { orderedIds, stageMap } = useQuoteStages();
  const [mobileStage, setMobileStage] = useState<QuoteStageId>(QUOTE_STAGE.PENDING);
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
      modal.confirm({
        title: t(`pipeline.confirm.${to}.title`),
        content: t(`pipeline.confirm.${to}.content`),
        okText: t(`pipeline.confirm.${to}.ok`),
        okButtonProps: to === QUOTE_STAGE.CANCELLED ? { danger: true } : undefined,
        onOk: () => commitTransition(id, to),
      });
    } else {
      void commitTransition(id, to);
    }
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const dragged = active.data.current as { card: QuoteCardType } | undefined;
    if (!dragged) return;
    const toStage = over.id as QuoteStageId;
    const fromStage = dragged.card.stageId as QuoteStageId;
    if (fromStage === toStage) return;
    runTransition(dragged.card.id, fromStage, toStage);
  };

  return (
    <div>
      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {orderedIds.map((stageId) => (
            <Skeleton key={stageId} active paragraph={{ rows: 4 }} />
          ))}
        </div>
      ) : isDesktop ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {orderedIds.map((stageId) => (
              <PipelineColumn
                key={stageId}
                stageId={stageId}
                cards={data[stageId]}
                onMove={runTransition}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto pb-1">
            <Segmented
              value={mobileStage}
              onChange={(value) => setMobileStage(value as QuoteStageId)}
              options={orderedIds.map((id) => ({ value: id, label: stageMap.get(id)?.label }))}
            />
          </div>
          <PipelineColumn
            stageId={mobileStage}
            cards={data[mobileStage]}
            onMove={runTransition}
            draggable={false}
          />
        </div>
      )}
    </div>
  );
}
