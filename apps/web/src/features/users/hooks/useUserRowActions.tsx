'use client';
import { App } from 'antd';
import { KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RowActionItem } from '@/components/shared/DataTable';
import { useGeneratePasswordSetupLink } from './useUsers';
import type { User } from '../types';

interface UseUserRowActionsParams {
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onPasswordSetupLink: (
    url: string,
    name: string,
    email: string,
    reason: 'create' | 'reset',
  ) => void;
}

export function useUserRowActions({
  onEdit,
  onDelete,
  onPasswordSetupLink,
}: UseUserRowActionsParams) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const { message } = App.useApp();
  const { generatePasswordSetupLink } = useGeneratePasswordSetupLink();

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
      key: 'sendPasswordLink',
      label: t('rowActions.sendPasswordLink'),
      icon: <KeyRound size={16} />,
      guard: { user: ['set-password'] },
      onClick: async () => {
        try {
          const { setupUrl, reason } = await generatePasswordSetupLink(user.id);
          onPasswordSetupLink(setupUrl, user.name, user.email, reason);
        } catch {
          // error notificado por useApiError
        }
      },
    },
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
