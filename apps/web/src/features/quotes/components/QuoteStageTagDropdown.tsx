'use client';
import { useState } from 'react';
import { Dropdown, Tag } from 'antd';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { QUOTE_STAGE, QUOTE_STAGE_TRANSITIONS, type QuoteStageId } from '@repo/schemas';
import { useQuoteStages } from '@/features/settings';
import { useCan } from '@/lib/auth/useCan';
import { hexToRgba } from '@/lib/utils/color';
import { useApproveQuote, useCancelQuote, useUpdateQuoteStage } from '../hooks/useQuotes';
import { useQuoteStageGuard } from '../hooks/useQuoteStageGuard';

interface QuoteStageTagDropdownProps {
  quoteId: string;
  stageId: QuoteStageId;
  isDraft?: boolean;
  className?: string;
  /** Trigger label: the stage name (default) or a "Move to…" prompt (pipeline card). */
  triggerLabel?: 'stage' | 'moveTo';
}

export function QuoteStageTagDropdown({
  quoteId,
  stageId,
  isDraft,
  className,
  triggerLabel = 'stage',
}: QuoteStageTagDropdownProps) {
  const { t } = useTranslation('quotes');
  const { stageMap } = useQuoteStages();
  const can = useCan();
  const [open, setOpen] = useState(false);
  const { guardTransition, confirmContextHolder } = useQuoteStageGuard();
  const { updateStage } = useUpdateQuoteStage();
  const { approveQuote } = useApproveQuote();
  const { cancelQuote } = useCancelQuote();

  const currentStage = stageMap.get(stageId);
  const moveOptions = QUOTE_STAGE_TRANSITIONS[stageId];
  const canChange = can({ [RESOURCES.QUOTE]: [ACTIONS.UPDATE] }) && moveOptions.length > 0;

  if (!currentStage) return null;

  if (!canChange) {
    return (
      <Tag color={currentStage.color} className={className}>
        {currentStage.label}
      </Tag>
    );
  }

  const commitTransition = (to: QuoteStageId) => {
    if (to === QUOTE_STAGE.CONFIRMED) return approveQuote(quoteId);
    if (to === QUOTE_STAGE.CANCELLED) return cancelQuote(quoteId);
    return updateStage(quoteId, to);
  };

  const selectStage = (to: QuoteStageId) => {
    setOpen(false);
    guardTransition(stageId, to, isDraft ?? false, () => commitTransition(to));
  };

  return (
    <>
      <Dropdown
        trigger={['click']}
        open={open}
        onOpenChange={setOpen}
        popupRender={() => (
          <div className="border-line-strong w-56 rounded-2xl border bg-white p-1.5 shadow-lg">
            <div className="flex items-center justify-between gap-2.5 rounded-xl bg-gray-100 px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: currentStage.color }}
                />
                <span className="text-base">{currentStage.label}</span>
              </div>
              <Check size={16} className="text-gray-400" />
            </div>
            {moveOptions.map((to) => {
              const stage = stageMap.get(to);
              if (!stage) return null;
              return (
                <button
                  key={to}
                  type="button"
                  onClick={() => selectStage(to)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-gray-50"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="text-base">{stage.label}</span>
                </button>
              );
            })}
          </div>
        )}
      >
        <button
          type="button"
          className={`flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${className ?? ''}`}
          style={{
            backgroundColor: hexToRgba(currentStage.color, 0.15),
            color: currentStage.color,
          }}
        >
          {triggerLabel === 'moveTo' ? t('pipeline.moveTo') : currentStage.label}
          <ChevronDown size={14} />
        </button>
      </Dropdown>
      {confirmContextHolder}
    </>
  );
}
