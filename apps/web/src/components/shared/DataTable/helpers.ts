import { Copy, Eye, Pencil, Trash2, type LucideIcon } from 'lucide-react';
import type { ActionPreset, RowActionItem, RowActionKey } from './types';

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
