'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Button, Card, Divider, Tooltip } from 'antd';
import { useDraggable } from '@dnd-kit/core';
import { UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { QUOTE_STAGE, type QuoteStageId } from '@repo/schemas';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useCan } from '@/lib/auth/useCan';
import { MB } from '@/theme/antd';
import { useQuoteRowActions } from '../../hooks/useQuoteRowActions';
import type { QuoteCard as QuoteCardType } from '../../types';
import { QuoteStageTagDropdown } from '../QuoteStageTagDropdown';
import { AssignStaffModal } from './AssignStaffModal';
import { QuoteCardBody } from './QuoteCardBody';

interface QuoteCardProps {
  card: QuoteCardType;
  draggable?: boolean;
}

export function QuoteCard({ card, draggable }: QuoteCardProps) {
  const { t } = useTranslation('quotes');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const can = useCan();
  const rowActions = useQuoteRowActions();
  const [assignOpen, setAssignOpen] = useState(false);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { card },
    disabled: !draggable,
  });

  const stageId = card.stageId as QuoteStageId;

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
        {!draggable && (
          <div onClick={(e) => e.stopPropagation()}>
            <QuoteStageTagDropdown
              quoteId={card.id}
              stageId={stageId}
              isDraft={card.isDraft}
              triggerLabel="moveTo"
            />
          </div>
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
      {/* Stops the modal portal content from bubbling clicks up to the Card's onClick
          (React portals bubble through the component tree, not the DOM tree). */}
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
