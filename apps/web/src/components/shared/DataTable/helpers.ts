import { Copy, Eye, Pencil, Trash2, type LucideIcon } from 'lucide-react';
import type { RowActionKey } from './types';

export interface ActionPreset {
  labelKey: string;
  Icon: LucideIcon;
  danger?: boolean;
}

export const ACTION_PRESETS: Record<RowActionKey, ActionPreset> = {
  copyId: { labelKey: 'table.copyId', Icon: Copy },
  detail: { labelKey: 'detail', Icon: Eye },
  edit: { labelKey: 'edit', Icon: Pencil },
  delete: { labelKey: 'delete', Icon: Trash2, danger: true },
};
