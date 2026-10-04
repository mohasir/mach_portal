'use client';
import { useState } from 'react';
import { Checkbox, Empty, Input } from 'antd';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FilterPanelHeader } from './FilterPanelHeader';
import type { FilterOption } from './types';

interface FilterOptionListProps {
  title: string;
  options: FilterOption[];
  value: string[];
  onChange: (value: string[]) => void;
  searchable?: boolean;
}

/** Checkbox list behind a FilterChipSelect; every tick applies right away. */
export function FilterOptionList({
  title,
  options,
  value,
  onChange,
  searchable,
}: FilterOptionListProps) {
  const { t } = useTranslation('common');
  const [query, setQuery] = useState('');
  const selected = new Set(value);

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options;

  const toggle = (optionValue: string) =>
    onChange(
      selected.has(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue],
    );

  return (
    <div className="flex flex-col">
      <FilterPanelHeader
        title={title}
        clearDisabled={value.length === 0}
        onClear={() => onChange([])}
      />
      {searchable && (
        <div className="px-4 pb-2">
          <Input
            allowClear
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('table.search')}
            prefix={<Search size={16} className="text-muted" />}
          />
        </div>
      )}
      {visible.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} className="my-4" />
      ) : (
        visible.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-olive-faint"
          >
            {option.icon}
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            <Checkbox checked={selected.has(option.value)} onChange={() => toggle(option.value)} />
          </label>
        ))
      )}
    </div>
  );
}
