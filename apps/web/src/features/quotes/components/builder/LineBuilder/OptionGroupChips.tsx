'use client';
import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { OptionGroup } from '@/features/catalog';

interface OptionGroupChipsProps {
  group: OptionGroup;
  selectedIds: string[];
  onChange: (optionIds: string[]) => void;
  readOnly?: boolean;
}

export function OptionGroupChips({
  group,
  selectedIds,
  onChange,
  readOnly,
}: OptionGroupChipsProps) {
  const { t } = useTranslation('quotes');
  const isIncluded = group.selectionType === 'included';
  const atLimit = group.maxSelect != null && selectedIds.length >= group.maxSelect;

  const toggle = (optionId: string) => {
    const next = selectedIds.includes(optionId)
      ? selectedIds.filter((id) => id !== optionId)
      : [...selectedIds, optionId];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-medium">{group.label}</span>
        <span className="text-xs text-gray-500">
          {isIncluded
            ? t('builder.lines.included')
            : group.maxSelect != null
              ? t('builder.lines.maxSelect', { selected: selectedIds.length, max: group.maxSelect })
              : t('builder.lines.selectAny')}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {group.options.map((option) => {
          const checked = isIncluded || selectedIds.includes(option.id);
          const disabled = isIncluded || !!readOnly || (!checked && atLimit);
          return (
            <Tag.CheckableTag
              key={option.id}
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(option.id)}
            >
              {option.name}
            </Tag.CheckableTag>
          );
        })}
      </div>
    </div>
  );
}
