'use client';
import { useState } from 'react';
import { Button, Input, Spin } from 'antd';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SearchInputProps {
  placeholder?: string;
  /** The search currently applied. The field resets to it whenever it changes from outside
   * (e.g. a separate "clear search" action); typing only applies on Enter or the icon. */
  value?: string;
  /** Fires with the trimmed text on Enter or the search icon, and with '' when cleared. */
  onSearch: (value: string) => void;
  disabled?: boolean;
  /** Swaps the search icon for a spinner while results for the current query are loading. */
  loading?: boolean;
  className?: string;
}

export function SearchInput({
  placeholder,
  value,
  onSearch,
  disabled,
  loading,
  className,
}: SearchInputProps) {
  const { t } = useTranslation('common');
  const [text, setText] = useState(value ?? '');
  const [syncedValue, setSyncedValue] = useState(value);

  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(value ?? '');
  }

  return (
    <Input
      allowClear
      type="search"
      enterKeyHint="search"
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      onPressEnter={() => onSearch(text.trim())}
      onClear={() => onSearch('')}
      className={className}
      suffix={
        loading ? (
          <div className="flex items-center justify-center w-6 h-6">
            <Spin size="small" />
          </div>
        ) : (
          <Button
            type="text"
            size="small"
            shape="circle"
            icon={<Search size={16} />}
            aria-label={t('table.search')}
            disabled={disabled}
            onClick={() => onSearch(text.trim())}
            className="text-muted"
          />
        )
      }
    />
  );
}
