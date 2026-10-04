'use client';
import type { ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';

interface FilterChipProps extends Omit<ComponentProps<'button'>, 'type'> {
  active: boolean;
  /** Shows a chevron: the chip opens a list of options instead of toggling on its own. */
  expandable?: boolean;
}

/**
 * Pill-shaped filter trigger; filled with the primary color while its filter is applied.
 * Extra props and the ref are forwarded so wrappers like Popover can attach to it.
 */
export function FilterChip({
  active,
  expandable,
  className,
  children,
  ...buttonProps
}: FilterChipProps) {
  return (
    <button
      {...buttonProps}
      type="button"
      aria-pressed={expandable ? undefined : active}
      className={`flex shrink-0 cursor-pointer items-center gap-1 rounded-md border px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        active
          ? 'border-primary bg-primary text-white'
          : 'border-line bg-surface text-muted hover:border-primary hover:text-primary'
      } ${className ?? ''}`}
    >
      <span className="max-w-52 truncate">{children}</span>
      {expandable && <ChevronDown size={14} className="shrink-0" />}
    </button>
  );
}
