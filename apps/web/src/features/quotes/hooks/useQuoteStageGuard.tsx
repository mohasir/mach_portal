'use client';
import { App, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { QUOTE_STAGE, canTransition, type QuoteStageId } from '@repo/schemas';
import { useConfirmModal } from '@/components/shared/ConfirmDialogs';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';

const CONFIRM_STAGES: QuoteStageId[] = [QUOTE_STAGE.CONFIRMED, QUOTE_STAGE.CANCELLED];

const CONFIRM_STAGE_KEYS: Partial<Record<QuoteStageId, string>> = {
  [QUOTE_STAGE.CONFIRMED]: 'confirmed',
  [QUOTE_STAGE.CANCELLED]: 'cancelled',
};

/**
 * Shared guardrails for a quote stage transition: validates `canTransition`, confirms
 * before CONFIRMED/CANCELLED, and warns before a draft leaves PENDING — independent of
 * how the transition is actually committed (optimistic for drag-and-drop, plain elsewhere).
 */
export function useQuoteStageGuard() {
  const { t } = useTranslation('quotes');
  const { modal } = App.useApp();
  const isDesktop = useIsDesktop();
  const [confirmAction, confirmContextHolder] = useConfirmModal();

  const guardTransition = (
    from: QuoteStageId,
    to: QuoteStageId,
    isDraft: boolean,
    commit: () => unknown,
  ) => {
    if (!canTransition(from, to)) return;

    const proceed = () => {
      if (CONFIRM_STAGES.includes(to)) {
        const stageKey = CONFIRM_STAGE_KEYS[to];
        const options = {
          title: t(`pipeline.confirm.${stageKey}.title`),
          content: t(`pipeline.confirm.${stageKey}.content`),
          okText: t(`pipeline.confirm.${stageKey}.ok`),
          onOk: () => commit(),
        };
        const danger = to === QUOTE_STAGE.CANCELLED;
        if (!isDesktop) return confirmAction({ ...options, danger });
        modal.confirm({ ...options, okButtonProps: danger ? { danger: true } : undefined });
      } else {
        void commit();
      }
    };

    // Leaving Pending while still a draft needs an extra heads-up — clearing `isDraft` on
    // the transition (QuotesRepository.updateStage) is otherwise silent.
    if (from === QUOTE_STAGE.PENDING && isDraft) {
      const draftOptions = {
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
      };
      if (!isDesktop) return confirmAction(draftOptions);
      modal.confirm(draftOptions);
      return;
    }
    proceed();
  };

  return { guardTransition, confirmContextHolder };
}
