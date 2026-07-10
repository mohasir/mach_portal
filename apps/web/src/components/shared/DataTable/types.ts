import type { ReactNode } from 'react';
import type { PermissionCheck } from '@repo/guards';

interface RowActionConfirm {
  title: string;
  content?: string;
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
