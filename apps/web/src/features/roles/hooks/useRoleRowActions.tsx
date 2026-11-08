'use client';
import { App } from 'antd';
import { CopyPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { RowActionItem } from '@/components/shared/DataTable';
import { useCan } from '@/lib/auth/useCan';
import { deleteBlock } from '../lib/roleErrors';
import type { Role } from '../types';

interface UseRoleRowActionsParams {
  onOpen: (role: Role) => void;
  onDuplicate: (role: Role) => void;
  onDelete: (role: Role) => void;
}

export function useRoleRowActions({ onOpen, onDuplicate, onDelete }: UseRoleRowActionsParams) {
  const { t } = useTranslation('roles');
  const { t: tc } = useTranslation('common');
  const { message } = App.useApp();
  const canUpdate = useCan()({ [RESOURCES.ROLE]: [ACTIONS.UPDATE] });

  return (role: Role): RowActionItem[] => {
    const items: RowActionItem[] = [
      {
        key: 'copyId',
        onClick: () => {
          void navigator.clipboard.writeText(role.id);
          message.success(tc('table.copied'));
        },
      },
      { type: 'divider' },
    ];

    if (role.isOwner || !canUpdate) {
      items.push({
        key: 'detail',
        label: t('rowActions.view'),
        guard: { [RESOURCES.ROLE]: [ACTIONS.READ] },
        onClick: () => onOpen(role),
      });
    } else {
      items.push({
        key: 'edit',
        guard: { [RESOURCES.ROLE]: [ACTIONS.UPDATE] },
        onClick: () => onOpen(role),
      });
    }

    items.push({
      key: 'duplicate',
      label: t('rowActions.duplicate'),
      icon: <CopyPlus size={16} />,
      guard: { [RESOURCES.ROLE]: [ACTIONS.CREATE] },
      disabled: role.isOwner,
      onClick: () => onDuplicate(role),
    });

    if (!role.isOwner) {
      items.push({
        key: 'delete',
        guard: { [RESOURCES.ROLE]: [ACTIONS.DELETE] },
        validate: async () => {
          const block = deleteBlock(role);
          return block
            ? {
                allowed: false,
                title: t('delete.inUseTitle'),
                content: t('delete.inUseContent', { count: block.memberCount }),
              }
            : { allowed: true };
        },
        confirm: { content: t('delete.confirmContent', { name: role.name }) },
        onClick: () => onDelete(role),
      });
    }

    return items;
  };
}
