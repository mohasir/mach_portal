'use client';
import type { ReactNode } from 'react';
import { Button, Tooltip } from 'antd';
import { TbExternalLink, TbLink } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { QuoteAssignmentAvatars } from './QuoteAssignmentAvatars';
import { IconBadge } from './IconBadge';

interface QuoteNumberHeaderProps {
  number: string;
  createdBy?: ReactNode;
  onCopy: () => void;
  showQuoteLink?: boolean;
  onViewQuote?: () => void;
  onCopyLink?: () => void;
  quoteId?: string;
  createdByName?: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  editableAssignment?: boolean;
}

export function QuoteNumberHeader({
  number,
  createdBy,
  onCopy,
  showQuoteLink,
  onViewQuote,
  onCopyLink,
  quoteId,
  createdByName,
  assignedToId,
  assignedToName,
  editableAssignment,
}: QuoteNumberHeaderProps) {
  const { t } = useTranslation('common');
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="cursor-pointer text-base font-semibold" onClick={onCopy}>
            {number}
          </span>
          {showQuoteLink && (
            <Button
              type="text"
              size="small"
              icon={
                <IconBadge
                  icon={TbExternalLink}
                  shape="square"
                  badgeSize="sm"
                  size={14}
                  rounded="rounded-lg"
                  className="bg-primary/5 text-primary"
                />
              }
              onClick={onViewQuote}
            />
          )}
          {onCopyLink && (
            <Tooltip title={t('share.copyLink')}>
              <Button
                type="text"
                size="small"
                icon={
                  <IconBadge
                    icon={TbLink}
                    shape="square"
                    badgeSize="sm"
                    size={14}
                    rounded="rounded-lg"
                    className="bg-primary/5 text-primary"
                  />
                }
                onClick={onCopyLink}
              />
            </Tooltip>
          )}
        </div>
        {quoteId && (
          <QuoteAssignmentAvatars
            quoteId={quoteId}
            createdByName={createdByName}
            assignedToId={assignedToId}
            assignedToName={assignedToName}
            editable={editableAssignment}
          />
        )}
      </div>
      {createdBy && <span className="text-xs text-gray-500 italic">{createdBy}</span>}
    </div>
  );
}
