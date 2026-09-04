'use client';
import { Tag } from 'antd';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OptionGroup } from '@/features/catalog';

interface OptionGroupSelectListProps {
  group: OptionGroup;
  selectedIds: string[];
  onChange?: (optionIds: string[]) => void;
  readOnly?: boolean;
}

export function OptionGroupSelectList({
  group,
  selectedIds,
  onChange,
  readOnly,
}: OptionGroupSelectListProps) {
  const { t } = useTranslation('quotes');
  const isIncluded = group.selectionType === 'included';
  const atLimit = group.maxSelect != null && selectedIds.length >= group.maxSelect;

  const toggle = (optionId: string) => {
    if (!onChange) return;
    const next = selectedIds.includes(optionId)
      ? selectedIds.filter((id) => id !== optionId)
      : [...selectedIds, optionId];
    onChange(next);
  };

  const options = isIncluded
    ? group.options
    : readOnly
      ? group.options.filter((option) => selectedIds.includes(option.id))
      : group.options;

  return (
    <div className="border-line flex flex-col gap-2 rounded-xl border bg-gray-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-medium">{group.label}</span>
        {isIncluded ? (
          <Tag color="green" className="m-0">
            {t('builder.lines.included')}
          </Tag>
        ) : (
          <span className="text-xs text-gray-500">
            {group.maxSelect != null
              ? t('builder.lines.maxSelect', { selected: selectedIds.length, max: group.maxSelect })
              : t('builder.lines.selectAny')}
          </span>
        )}
      </div>
      <div className="flex flex-col">
        {options.map((option) => {
          const checked = isIncluded || selectedIds.includes(option.id);
          const checkBadge = (
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                checked ? 'border-primary bg-primary text-ivory' : 'border-line'
              }`}
            >
              {checked && <Check size={12} />}
            </span>
          );

          if (readOnly) {
            return (
              <div key={option.id} className="flex items-center gap-2 py-1 text-sm">
                {checkBadge}
                <span>{option.name}</span>
              </div>
            );
          }

          const disabled = isIncluded || (!checked && atLimit);
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(option.id)}
              className="flex items-center gap-2 py-1 text-left text-sm disabled:opacity-50"
            >
              {checkBadge}
              <span>{option.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
