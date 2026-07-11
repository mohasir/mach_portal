import type { ReactNode } from 'react';
import type { PermissionCheck } from '@repo/guards';
import type { LucideIcon } from 'lucide-react';
import type { SortDir } from '@repo/schemas';

/** i18n keys (common namespace) for the confirm defaults a preset injects when a caller omits them. */
export interface ActionPresetConfirm {
  titleKey?: string;
  captionKey?: string;
}

export interface ActionPreset {
  labelKey: string;
  Icon: LucideIcon;
  danger?: boolean;
  confirm?: ActionPresetConfirm;
}

interface RowActionConfirm {
  title?: string;
  content?: string;
  caption?: string;
  okText?: string;
  cancelText?: string;
}

export type RowActionKey = 'copyId' | 'detail' | 'edit' | 'delete';

export interface RowAction {
  key: RowActionKey | (string & {});
  label?: string;
  icon?: ReactNode;
  danger?: boolean;
  onClick: () => void;
  guard?: PermissionCheck;
  confirm?: RowActionConfirm;
}

export type RowActionItem = RowAction | { type: 'divider' };

export interface DataTableChange {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: SortDir;
}

export interface UseDataTableOptions<TSort extends string> {
  defaultSortBy: TSort;
  defaultSortDir?: SortDir;
  defaultPageSize?: number;
}
