'use client';
import { Divider } from 'antd';
import { QuoteAssignmentAvatars } from '@/components/shared/QuoteAssignmentAvatars';
import { useCanReassignQuote } from '@/lib/auth/useCan';
import type { QuoteCard as QuoteCardType } from '../../types';

interface QuoteCardAssignmentProps {
  card: QuoteCardType;
}

export function QuoteCardAssignment({ card }: QuoteCardAssignmentProps) {
  const canReassign = useCanReassignQuote();

  if (!card.createdByName && !card.assignedToName && !canReassign) return null;

  return (
    <>
      <Divider className="my-2" />
      {/* Also stops the sheet portal content from bubbling clicks up to the Card's
          onClick (React portals bubble through the component tree, not the DOM tree). */}
      <div onClick={(e) => e.stopPropagation()}>
        <QuoteAssignmentAvatars
          quoteId={card.id}
          createdByName={card.createdByName}
          assignedToId={card.assignedToId}
          assignedToName={card.assignedToName}
          editable
        />
      </div>
    </>
  );
}
