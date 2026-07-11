'use client';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import type { RowActionItem } from '@/components/shared/DataTable';
import type { User } from '../types';

interface UseUserRowActionsParams {
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export function useUserRowActions({ onEdit, onDelete }: UseUserRowActionsParams) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const { message } = App.useApp();

  return (user: User): RowActionItem[] => [
    {
      key: 'copyId',
      onClick: () => {
        void navigator.clipboard.writeText(user.id);
        message.success(tc('table.copied'));
      },
    },
    { type: 'divider' },
    {
      key: 'edit',
      guard: { user: ['update'] },
      onClick: () => onEdit(user),
    },
    {
      key: 'delete',
      guard: { user: ['delete'] },
      onClick: () => onDelete(user),
      confirm: {
        content: t('delete.confirmContent', { name: user.name || user.email }),
      },
    },
  ];
}