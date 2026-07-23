'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Button, Card, Divider, Tooltip } from 'antd';
import { useDraggable } from '@dnd-kit/core';
import { ChevronDown, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { QUOTE_STAGE, QUOTE_STAGE_TRANSITIONS, type QuoteStageId } from '@repo/schemas';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useCan } from '@/lib/auth/useCan';
import { useQuoteStages } from '@/features/settings';
import { hexToRgba } from '@/lib/utils/color';
import { MB } from '@/theme/antd';
import { useQuoteRowActions } from '../../hooks/useQuoteRowActions';
import type { QuoteCard as QuoteCardType } from '../../types';
import { AssignStaffModal } from './AssignStaffModal';
import { QuoteCardBody } from './QuoteCardBody';

interface QuoteCardProps {
  card: QuoteCardType;
  draggable?: boolean;
  onMove: (id: string, from: QuoteStageId, to: QuoteStageId, isDraft: boolean) => void;
}

export function QuoteCard({ card, draggable, onMove }: QuoteCardProps) {
  const { t } = useTranslation('quotes');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const { stageMap } = useQuoteStages();
  const can = useCan();
  const rowActions = useQuoteRowActions();
  const [assignOpen, setAssignOpen] = useState(false);
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { card },
    disabled: !draggable,
  });

  const stageId = card.stageId as QuoteStageId;
  const currentStage = stageMap.get(stageId);

  const moveOptions = QUOTE_STAGE_TRANSITIONS[stageId];

  return (
    <Card
      ref={draggable ? setNodeRef : undefined}
      size="small"
      className={isDragging ? 'opacity-40' : 'cursor-pointer'}
      onClick={() =>
        router.push(
          stageId === QUOTE_STAGE.PENDING
            ? `/admin/quotes/${card.id}`
            : `/admin/quotes/preview/${card.id}`,
        )
      }
      {...(draggable ? { ...attributes, ...listeners } : {})}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        {!draggable && moveOptions.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMoveSheetOpen(true);
            }}
            className="flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
            style={
              currentStage
                ? { backgroundColor: hexToRgba(currentStage.color, 0.15), color: currentStage.color }
                : undefined
            }
          >
            {t('pipeline.moveTo')}
            <ChevronDown size={14} />
          </button>
        )}
        <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
          <DataTableRowActions actions={rowActions(card)} label={tc('table.actions')} />
        </div>
      </div>
      <QuoteCardBody card={card} />
      {stageId === QUOTE_STAGE.CONFIRMED && can({ [RESOURCES.EVENT]: [ACTIONS.UPDATE] }) && (
        <>
          <Divider className="my-2" />
          <div
            className="mt-2 flex items-center justify-between gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {card.staffMembers.length > 0 ? (
              <Avatar.Group
                max={{ count: 3, style: { backgroundColor: MB.oliveFaint, color: MB.brown } }}
              >
                {card.staffMembers.map((member) => (
                  <Tooltip key={member.id} title={member.name}>
                    <Avatar className="bg-olive-faint text-brown font-medium">
                      {member.name[0]?.toUpperCase()}
                    </Avatar>
                  </Tooltip>
                ))}
              </Avatar.Group>
            ) : (
              <span className="text-xs text-gray-500">{t('pipeline.noStaff')}</span>
            )}
            <Button
              shape="circle"
              size="small"
              icon={<UserPlus size={14} />}
              aria-label={t('pipeline.assignStaff')}
              onClick={() => setAssignOpen(true)}
              className="h-8 w-8"
            />
          </div>
        </>
      )}
      {/* Stops the sheet/modal portal content from bubbling clicks up to the Card's onClick
          (React portals bubble through the component tree, not the DOM tree). */}
      <div onClick={(e) => e.stopPropagation()}>
        <BottomSheet
          open={moveSheetOpen}
          onClose={() => setMoveSheetOpen(false)}
          title={t('pipeline.moveTo')}
        >
          {moveOptions.map((to, index) => {
            const stage = stageMap.get(to);
            return (
              <button
                key={to}
                type="button"
                onClick={() => {
                  setMoveSheetOpen(false);
                  onMove(card.id, stageId, to, card.isDraft);
                }}
                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${
                  index > 0 ? 'border-line/50 border-t' : ''
                }`}
              >
                <span>{stage?.label}</span>
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={
                    stage
                      ? { backgroundColor: hexToRgba(stage.color, 0.15), color: stage.color }
                      : undefined
                  }
                >
                  {stage?.label}
                </span>
              </button>
            );
          })}
        </BottomSheet>
        <AssignStaffModal
          eventId={card.eventId}
          eventDate={card.eventDate}
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
        />
      </div>
    </Card>
  );
}
