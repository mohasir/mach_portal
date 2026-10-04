'use client';
import { FilterChip } from './FilterChip';

interface FilterChipToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** On/off filter (e.g. "Drafts only") rendered as a single chip. */
export function FilterChipToggle({ label, checked, onChange }: FilterChipToggleProps) {
  return (
    <FilterChip active={checked} onClick={() => onChange(!checked)}>
      {label}
    </FilterChip>
  );
}
