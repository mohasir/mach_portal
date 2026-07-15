'use client';
import { useState } from 'react';
import { App, Segmented, Skeleton } from 'antd';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { canTransition, type QuoteStage } from '@repo/schemas';
import { PageHeader } from '@/components/shared/PageHeader';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { usePipelineBoard, usePipelineTransitions } from '../../hooks/usePipelineBoard';
import type { QuoteCard as QuoteCardType } from '../../types';
import { PipelineColumn } from './PipelineColumn';

const STAGES: QuoteStage[] = ['new', 'quoted', 'confirmed', 'completed', 'cancelled'];
const CONFIRM_STAGES: QuoteStage[] = ['confirmed', 'cancelled'];

export function PipelineBoard() {
  const { t } = useTranslation('quotes');
  const { modal } = App.useApp();
  const isDesktop = useIsDesktop();
  const [mobileStage, setMobileStage] = useState<QuoteStage>('new');
  const boardQuery = {};
  const { data, isLoading } = usePipelineBoard(boardQuery);
  const { moveStage, approve, cancel } = usePipelineTransitions(boardQuery);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const commitTransition = (id: string, to: QuoteStage) => {
    if (to === 'confirmed') return approve(id);
    if (to === 'cancelled') return cancel(id);
    return moveStage(id, to);
  };

  const runTransition = (id: string, from: QuoteStage, to: QuoteStage) => {
    if (!canTransition(from, to)) return;

    if (CONFIRM_STAGES.includes(to)) {
      modal.confirm({
        title: t(`pipeline.confirm.${to}.title`),
        content: t(`pipeline.confirm.${to}.content`),
        okText: t(`pipeline.confirm.${to}.ok`),
        okButtonProps: to === 'cancelled' ? { danger: true } : undefined,
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
    const toStage = over.id as QuoteStage;
    if (dragged.card.stage === toStage) return;
    runTransition(dragged.card.id, dragged.card.stage, toStage);
  };

  return (
    <div>
      <PageHeader title={t('pipeline.title')} />

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {STAGES.map((stage) => (
            <Skeleton key={stage} active paragraph={{ rows: 4 }} />
          ))}
        </div>
      ) : isDesktop ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {STAGES.map((stage) => (
              <PipelineColumn
                key={stage}
                stage={stage}
                cards={data[stage]}
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
              onChange={(value) => setMobileStage(value as QuoteStage)}
              options={STAGES.map((s) => ({ value: s, label: t(`stage.${s}`) }))}
            />
          </div>
          <PipelineColumn
            stage={mobileStage}
            cards={data[mobileStage]}
            onMove={runTransition}
            draggable={false}
          />
        </div>
      )}
    </div>
  );
}
