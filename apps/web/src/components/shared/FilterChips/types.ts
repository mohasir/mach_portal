import type { ReactNode } from 'react';

export interface FilterOption {
  value: string;
  label: string;
  /** Leading visual for the row, e.g. an avatar or a color dot. */
  icon?: ReactNode;
}
