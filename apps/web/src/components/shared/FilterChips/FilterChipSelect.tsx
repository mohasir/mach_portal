'use client';
import { FilterChipPanel } from './FilterChipPanel';
import { FilterOptionList } from './FilterOptionList';
import type { FilterOption } from './types';

interface FilterChipSelectProps {
  /** Chip text while nothing is selected; also the title of the option list. */
  label: string;
  options: FilterOption[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Adds a text box above the options, for long lists. */
  searchable?: boolean;
}

/**
 * Multi-select filter as a chip. Once something is picked the chip fills with the primary color
 * and reads the selected labels.
 */
export function FilterChipSelect({
  label,
  options,
  value,
  onChange,
  searchable,
}: FilterChipSelectProps) {
  const selectedLabels = options
    .filter((option) => value.includes(option.value))
    .map((option) => option.label);

  return (
    <FilterChipPanel
      active={value.length > 0}
      label={selectedLabels.length ? selectedLabels.join(', ') : label}
    >
      <FilterOptionList
        title={label}
        options={options}
        value={value}
        onChange={onChange}
        searchable={searchable}
      />
    </FilterChipPanel>
  );
}
