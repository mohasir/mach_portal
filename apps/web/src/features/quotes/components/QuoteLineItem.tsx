'use client';
import { useState } from 'react';
import { Button, Typography } from 'antd';
import { ChevronDown, ChevronRight, Trash2, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';

export interface QuoteLineItemGroup {
  key: string;
  label: string;
  isIncluded: boolean;
  optionNames: string[];
}

interface QuoteLineItemProps {
  icon: LucideIcon;
  name: string;
  numPersons?: number;
  total?: number;
  groups: QuoteLineItemGroup[];
  onRemove?: () => void;
}

export function QuoteLineItem({
  icon: Icon,
  name,
  numPersons,
  total,
  groups,
  onRemove,
}: QuoteLineItemProps) {
  const { t } = useTranslation('quotes');
  const { money } = useMoneyFormatter();
  const [expanded, setExpanded] = useState(false);
  const hasDetails = groups.length > 0;

  return (
    <div className="border-line border-b py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        {hasDetails ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            {expanded ? (
              <ChevronDown size={14} className="shrink-0 text-gray-500" />
            ) : (
              <ChevronRight size={14} className="shrink-0 text-gray-500" />
            )}
            <Icon size={16} className="text-brown shrink-0" />
            <Typography.Text strong className="truncate text-base">
              {name}
            </Typography.Text>
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2 pl-5.5">
            <Icon size={16} className="text-brown shrink-0" />
            <Typography.Text strong className="truncate text-base">
              {name}
            </Typography.Text>
          </div>
        )}
        {numPersons !== undefined && (
          <span className="shrink-0 text-right text-xs text-gray-500">{numPersons}</span>
        )}
        {total !== undefined && (
          <span className="shrink-0 text-right text-base font-medium">{money(total)}</span>
        )}
        {onRemove && (
          <Button
            type="text"
            size="small"
            danger
            icon={<Trash2 size={14} />}
            onClick={onRemove}
            aria-label={t('builder.lines.remove')}
          />
        )}
      </div>
      {expanded && hasDetails && (
        <div className="mt-1.5 flex flex-col gap-2 pl-6">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col text-xs">
              <span className="mb-1 block text-gray-500">
                {group.label}
                {group.isIncluded ? ` | ${t('detail.includedLabel')}` : ''}:
              </span>
              <span>{group.optionNames.join(', ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
