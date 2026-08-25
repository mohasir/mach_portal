'use client';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { RowActionItem } from '@/components/shared/DataTable';
import type { Client } from '../types';

interface UseClientRowActionsParams {
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
}

export function useClientRowActions({ onEdit, onDelete }: UseClientRowActionsParams) {
  const { t } = useTranslation('clients');
  const { t: tc } = useTranslation('common');
  const { message } = App.useApp();

  return (client: Client): RowActionItem[] => [
    {
      key: 'copyId',
      onClick: () => {
        void navigator.clipboard.writeText(client.id);
        message.success(tc('table.copied'));
      },
    },
    { type: 'divider' },
    {
      key: 'edit',
      guard: { [RESOURCES.CLIENT]: [ACTIONS.UPDATE] },
      onClick: () => onEdit(client),
    },
    {
      key: 'delete',
      guard: { [RESOURCES.CLIENT]: [ACTIONS.DELETE] },
      onClick: () => onDelete(client),
      confirm: {
        content: t('delete.confirmContent', { name: client.name }),
      },
    },
  ];
}
