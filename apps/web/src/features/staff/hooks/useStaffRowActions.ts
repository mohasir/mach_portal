'use client';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { RowActionItem } from '@/components/shared/DataTable';
import type { Staff } from '../types';

interface UseStaffRowActionsParams {
  onEdit: (member: Staff) => void;
  onDelete: (member: Staff) => void;
}

export function useStaffRowActions({ onEdit, onDelete }: UseStaffRowActionsParams) {
  const { t } = useTranslation('staff');
  const { t: tc } = useTranslation('common');
  const { message } = App.useApp();

  return (member: Staff): RowActionItem[] => [
    {
      key: 'copyId',
      onClick: () => {
        void navigator.clipboard.writeText(member.id);
        message.success(tc('table.copied'));
      },
    },
    { type: 'divider' },
    {
      key: 'edit',
      guard: { [RESOURCES.STAFF]: [ACTIONS.UPDATE] },
      onClick: () => onEdit(member),
    },
    {
      key: 'delete',
      guard: { [RESOURCES.STAFF]: [ACTIONS.DELETE] },
      onClick: () => onDelete(member),
      confirm: {
        content: t('delete.confirmContent', { name: member.name }),
      },
    },
  ];
}
