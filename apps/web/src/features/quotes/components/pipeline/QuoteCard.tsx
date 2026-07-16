'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Dropdown, type MenuProps } from 'antd';
import { useDraggable } from '@dnd-kit/core';
import { MoveRight, UserPlus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { QUOTE_STAGE, QUOTE_STAGE_TRANSITIONS, type QuoteStageId } from '@repo/schemas';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useCan } from '@/lib/auth/useCan';
import { useQuoteStages } from '@/features/settings';
import { useQuoteRowActions } from '../../hooks/useQuoteRowActions';
import type { QuoteCard as QuoteCardType } from '../../types';
import { AssignStaffModal } from './AssignStaffModal';
import { QuoteCardBody } from './QuoteCardBody';

interface QuoteCardProps {
  card: QuoteCardType;
  draggable?: boolean;
  onMove: (id: string, from: QuoteStageId, to: QuoteStageId) => void;
}

export function QuoteCard({ card, draggable, onMove }: QuoteCardProps) {
  const { t } = useTranslation('quotes');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const { stageMap } = useQuoteStages();
  const can = useCan();
  const rowActions = useQuoteRowActions();
  const [assignOpen, setAssignOpen] = useState(false);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { card },
    disabled: !draggable,
  });

  const stageId = card.stageId as QuoteStageId;

  const moveOptions = QUOTE_STAGE_TRANSITIONS[stageId];
  const items: MenuProps['items'] = moveOptions.map((to) => ({
    key: to,
    label: stageMap.get(to)?.label,
    onClick: (info) => {
      info.domEvent.stopPropagation();
      onMove(card.id, stageId, to);
    },
  }));

  return (
    <Card
      ref={draggable ? setNodeRef : undefined}
      size="small"
      className={isDragging ? 'opacity-40' : 'cursor-pointer'}
      onClick={() => router.push(`/admin/quotes/${card.id}`)}
      {...(draggable ? { ...attributes, ...listeners } : {})}
    >
      <QuoteCardBody
        card={card}
        actions={
          <div onClick={(e) => e.stopPropagation()}>
            <DataTableRowActions actions={rowActions(card)} label={tc('table.actions')} />
          </div>
        }
      />
      {stageId === QUOTE_STAGE.CONFIRMED && can({ [RESOURCES.EVENT]: [ACTIONS.UPDATE] }) && (
        <div
          className="mt-2 flex items-center justify-between gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Users size={14} />
            {t('pipeline.staffCount', { count: card.staffAssignedCount })}
          </span>
          <Button size="small" icon={<UserPlus size={14} />} onClick={() => setAssignOpen(true)}>
            {t('pipeline.assignStaff')}
          </Button>
        </div>
      )}
      {!draggable && moveOptions.length > 0 && (
        <Dropdown menu={{ items }} trigger={['click']}>
          <div
            className="border-line mt-2 flex items-center justify-center gap-1 rounded border p-1.5 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <MoveRight size={14} /> {t('pipeline.moveTo')}
          </div>
        </Dropdown>
      )}
      {/* Stops the Modal's portal content from bubbling clicks up to the Card's onClick (React
          portals bubble through the component tree, not the DOM tree). */}
      <div onClick={(e) => e.stopPropagation()}>
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
