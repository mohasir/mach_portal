'use client';
import { useRouter } from 'next/navigation';
import { Card } from 'antd';
import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { QUOTE_STAGE, type QuoteStageId } from '@repo/schemas';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useQuoteRowActions } from '../../hooks/useQuoteRowActions';
import type { QuoteCard as QuoteCardType } from '../../types';
import { QuoteStageTagDropdown } from '../QuoteStageTagDropdown';
import { QuoteCardAssignment } from './QuoteCardAssignment';
import { QuoteCardBody } from './QuoteCardBody';

interface QuoteCardProps {
  card: QuoteCardType;
  draggable?: boolean;
}

export function QuoteCard({ card, draggable }: QuoteCardProps) {
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const rowActions = useQuoteRowActions();

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
      <QuoteCardAssignment card={card} />
    </Card>
  );
}
