'use client';
import { App, Skeleton, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { canTransition, QUOTE_STAGE, type QuoteStageId } from '@repo/schemas';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useQuoteStages } from '@/features/settings';
import { usePipelineBoard, usePipelineTransitions } from '../../hooks/usePipelineBoard';
import { PipelineBoardDesktop } from './PipelineBoardDesktop';
import { PipelineBoardMobile } from './PipelineBoardMobile';

const CONFIRM_STAGES: QuoteStageId[] = [QUOTE_STAGE.CONFIRMED, QUOTE_STAGE.CANCELLED];

const CONFIRM_STAGE_KEYS: Partial<Record<QuoteStageId, string>> = {
  [QUOTE_STAGE.CONFIRMED]: 'confirmed',
  [QUOTE_STAGE.CANCELLED]: 'cancelled',
};

export function PipelineBoard() {
  const { t } = useTranslation('quotes');
  const { modal } = App.useApp();
  const isDesktop = useIsDesktop();
  const { orderedIds } = useQuoteStages();
  const boardQuery = {};
  const { data, isLoading } = usePipelineBoard(boardQuery);
  const { moveStage, approve, cancel } = usePipelineTransitions(boardQuery);

  const commitTransition = (id: string, to: QuoteStageId) => {
    if (to === QUOTE_STAGE.CONFIRMED) return approve(id);
    if (to === QUOTE_STAGE.CANCELLED) return cancel(id);
    return moveStage(id, to);
  };

  const runTransition = (id: string, from: QuoteStageId, to: QuoteStageId, isDraft: boolean) => {
    if (!canTransition(from, to)) return;

    const proceed = () => {
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

    // Leaving Pending while still a draft needs an extra heads-up — clearing `isDraft` on
    // the transition (QuotesRepository.updateStage) is otherwise silent.
    if (from === QUOTE_STAGE.PENDING && isDraft) {
      modal.confirm({
        title: t('pipeline.confirm.draft.title'),
        content: (
          <div className="flex flex-col gap-1">
            <span>{t('pipeline.confirm.draft.content')}</span>
            <Typography.Text type="secondary" className="mt-1 text-xs">
              {t('pipeline.confirm.draft.caption')}
            </Typography.Text>
          </div>
        ),
        okText: t('pipeline.confirm.draft.ok'),
        onOk: proceed,
      });
      return;
    }
    proceed();
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
        <PipelineBoardDesktop data={data} orderedIds={orderedIds} onMove={runTransition} />
      ) : (
        <PipelineBoardMobile data={data} orderedIds={orderedIds} onMove={runTransition} />
      )}
    </div>
  );
}
