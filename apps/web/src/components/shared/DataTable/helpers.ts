import { Copy, Eye, Pencil, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TableColumnsType, TableColumnType } from 'antd';
import type { SortDir } from '@repo/schemas';
import type { ActionPreset, RowActionItem, RowActionKey } from './types';

const DESKTOP_ONLY = ['sm', 'md', 'lg', 'xl', 'xxl'] as const;
const MOBILE_ONLY = ['xs'] as const;

export function withMobileCard<TData>(
  columns: TableColumnsType<TData> | undefined,
  card: (record: TData, index: number) => ReactNode,
): TableColumnsType<TData> {
  const desktop = (columns ?? []).map((col) =>
    'responsive' in col && col.responsive ? col : { ...col, responsive: [...DESKTOP_ONLY] },
  );
  const mobileCard: TableColumnType<TData> = {
    key: '__mobileCard__',
    responsive: [...MOBILE_ONLY],
    render: (_, record, index) => card(record, index),
  };
  return [...desktop, mobileCard];
}

export const ACTION_PRESETS: Record<RowActionKey, ActionPreset> = {
  copyId: { labelKey: 'table.copyId', Icon: Copy },
  detail: { labelKey: 'detail', Icon: Eye },
  edit: { labelKey: 'edit', Icon: Pencil },
  delete: {
    labelKey: 'delete',
    Icon: Trash2,
    danger: true,
    confirm: { titleKey: 'confirm.title', captionKey: 'confirm.irreversible' },
  },
};

export const isDivider = (item: RowActionItem): item is { type: 'divider' } => 'type' in item;

/** Drops leading, trailing and consecutive dividers left behind after guard filtering. */
export function stripDividers(items: RowActionItem[]): RowActionItem[] {
  const out: RowActionItem[] = [];
  for (const item of items) {
    if (isDivider(item)) {
      const prev = out[out.length - 1];
      if (prev && !isDivider(prev)) out.push(item);
    } else {
      out.push(item);
    }
  }
  while (out.length && isDivider(out[out.length - 1]!)) out.pop();
  return out;
}

export function withSortOrder<TData>(
  columns: TableColumnsType<TData> | undefined,
  sortBy: string | undefined,
  sortDir: SortDir | undefined,
): TableColumnsType<TData> | undefined {
  if (!columns || !sortBy) return columns;
  const order = sortDir === 'asc' ? 'ascend' : 'descend';
  return columns.map((col) => {
    if (!('sorter' in col) || !col.sorter) return col;
    const field =
      'dataIndex' in col && col.dataIndex != null ? String(col.dataIndex) : String(col.key);
    return { ...col, sortOrder: field === sortBy ? order : null };
  }) as TableColumnsType<TData>;
}
