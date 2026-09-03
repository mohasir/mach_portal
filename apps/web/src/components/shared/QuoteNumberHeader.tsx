'use client';
import type { ReactNode } from 'react';
import { Button } from 'antd';
import { TbCopy, TbExternalLink } from 'react-icons/tb';
import { IconBadge } from './IconBadge';

interface QuoteNumberHeaderProps {
  number: string;
  createdBy?: ReactNode;
  onCopy: () => void;
  showQuoteLink?: boolean;
  onViewQuote?: () => void;
}

export function QuoteNumberHeader({
  number,
  createdBy,
  onCopy,
  showQuoteLink,
  onViewQuote,
}: QuoteNumberHeaderProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="block text-base font-semibold">{number}</span>
        <Button
          type="text"
          size="small"
          icon={
            <IconBadge
              icon={TbCopy}
              shape="square"
              badgeSize="sm"
              size={14}
              rounded="rounded-lg"
              className="bg-primary/5 text-primary"
            />
          }
          onClick={onCopy}
        />
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
      </div>
      {createdBy && <span className="text-xs text-gray-500 italic">{createdBy}</span>}
    </div>
  );
}
