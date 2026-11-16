'use client';
import { Select } from 'antd';
import { categoryOptions } from '../helpers';
import { useCategoryOptions } from '../hooks/useProductCategories';

interface CategorySelectProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  /** The product's category, offered even when it was deactivated afterwards. */
  current?: { id: string; name: string } | null;
  placeholder?: string;
}

/** Active categories; a controlled, clearable field for an AntD `Form.Item`. */
export function CategorySelect({ value, onChange, current, placeholder }: CategorySelectProps) {
  const { data: categories = [], isLoading } = useCategoryOptions();

  return (
    <Select
      value={value ?? undefined}
      onChange={(next?: string) => onChange?.(next ?? null)}
      options={categoryOptions(categories, current)}
      loading={isLoading}
      placeholder={placeholder}
      allowClear
      showSearch={{ optionFilterProp: 'label' }}
    />
  );
}
