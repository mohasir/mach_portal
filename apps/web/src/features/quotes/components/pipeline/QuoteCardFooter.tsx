'use client';
import { useRouter } from 'next/navigation';
import { Button, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { QUOTE_STAGE } from '@repo/schemas';
import { QuoteAssignmentAvatars } from '@/components/shared/QuoteAssignmentAvatars';
import { useCan, useCanReassignQuote } from '@/lib/auth/useCan';
import type { QuoteCard as QuoteCardType } from '../../types';

interface QuoteCardFooterProps {
  card: QuoteCardType;
}

/** Bottom row of a pipeline card: who created/owns the quote on the left, quick actions on the right. */
export function QuoteCardFooter({ card }: QuoteCardFooterProps) {
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const can = useCan();
  const canReassign = useCanReassignQuote() && !card.isArchived;
  const canEdit =
    !card.isArchived &&
    (card.stageId === QUOTE_STAGE.PENDING || card.stageId === QUOTE_STAGE.QUOTED) &&
    can({ [RESOURCES.QUOTE]: [ACTIONS.UPDATE] });

  if (!card.createdByName && !card.assignedToName && !canReassign && !canEdit) return null;

  return (
    <>
      <Divider className="my-2" />
      {/* Also stops the sheet portal content from bubbling clicks up to the Card's
          onClick (React portals bubble through the component tree, not the DOM tree). */}
      <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-between gap-2">
        <QuoteAssignmentAvatars
          quoteId={card.id}
          createdByName={card.createdByName}
          assignedToId={card.assignedToId}
          assignedToName={card.assignedToName}
          editable={!card.isArchived}
        />
        {canEdit && (
          <Button
            type="primary"
            size="small"
            onClick={() => router.push(`/admin/quotes/${card.id}`)}
            className="ml-auto"
          >
            {tc('edit')}
          </Button>
        )}
      </div>
    </>
  );
}
