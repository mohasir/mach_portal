'use client';
import { useState } from 'react';
import { Avatar, Tooltip } from 'antd';
import { UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AssignQuoteSheet } from '@/features/quotes/components/pipeline/AssignQuoteSheet';
import { useCanReassignQuote } from '@/lib/auth/useCan';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { AvatarUser } from './AvatarUser';

interface QuoteAssignmentAvatarsProps {
  quoteId: string;
  createdByName?: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  /** Reassigning also requires the QUOTE_UPDATE/'all' scope permission (useCanReassignQuote). */
  editable?: boolean;
}

export function QuoteAssignmentAvatars({
  quoteId,
  createdByName,
  assignedToId,
  assignedToName,
  editable,
}: QuoteAssignmentAvatarsProps) {
  const { t } = useTranslation('quotes');
  const hasReassignPermission = useCanReassignQuote();
  const canReassign = !!editable && hasReassignPermission;
  const [sheetOpen, setSheetOpen] = useState(false);
  const isDesktop = useIsDesktop();
  // On touch devices "hover" fires on tap, eating the click that opens the sheet — restrict
  // the tooltip to a long-press (native contextmenu) there instead.
  const tooltipTrigger = isDesktop ? 'hover' : 'contextMenu';

  if (!createdByName && !assignedToName && !canReassign) return null;

  return (
    <>
      <Avatar.Group>
        {createdByName && (
          <Tooltip
            trigger={tooltipTrigger}
            title={t('pipeline.createdBy', { name: createdByName })}
          >
            <AvatarUser name={createdByName} size={28} fontSize={12} showDetails={false} />
          </Tooltip>
        )}
        {assignedToName ? (
          <Tooltip
            trigger={tooltipTrigger}
            title={t('pipeline.assignedTo', { name: assignedToName })}
          >
            <span
              onClick={canReassign ? () => setSheetOpen(true) : undefined}
              className={canReassign ? 'cursor-pointer' : undefined}
            >
              <AvatarUser name={assignedToName} size={28} fontSize={14} showDetails={false} />
            </span>
          </Tooltip>
        ) : (
          canReassign && (
            <Tooltip trigger={tooltipTrigger} title={t('pipeline.assignQuote.action')}>
              <Avatar
                size={28}
                icon={<UserPlus size={14} />}
                onClick={() => setSheetOpen(true)}
                aria-label={t('pipeline.assignQuote.action')}
                className="bg-gray-200 text-gray-500 border-gray-500 cursor-pointer border border-dashed"
              />
            </Tooltip>
          )
        )}
      </Avatar.Group>
      <AssignQuoteSheet
        quoteId={quoteId}
        assignedToId={assignedToId}
        assignedToName={assignedToName}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
