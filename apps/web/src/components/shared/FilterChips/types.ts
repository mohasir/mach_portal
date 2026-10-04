import type { ReactNode } from 'react';

export interface FilterOption {
  value: string;
  label: string;
  /** Leading visual for the row, e.g. an avatar or a color dot. */
  icon?: ReactNode;
}

export type DateRangePreset = 'today' | 'last7Days' | 'thisMonth' | 'lastMonth';

/**
 * A quick preset (resolved to dates when used, see resolveDateRange) or a custom inclusive range
 * as ISO dates (YYYY-MM-DD) where either end may be open.
 */
export interface DateRangeValue {
  preset?: DateRangePreset;
  from?: string;
  to?: string;
}
