'use client';
import { App, Tag, type TableColumnsType } from 'antd';
import { type RoleType } from '@repo/guards';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions, type RowActionItem } from '@/components/shared/DataTable';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { ROLE_COLORS } from '../helpers';
import type { User } from '../types';

interface UseUsersColumnsParams {
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export function useUsersColumns({
  onEdit,
  onDelete,
}: UseUsersColumnsParams): TableColumnsType<User> {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const { date } = useDateFormatter();
  const { message } = App.useApp();

  const rowActions = (user: User): RowActionItem[] => [
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

  return [
    { title: t('columns.name'), dataIndex: 'name', key: 'name' },
    { title: t('columns.email'), dataIndex: 'email', key: 'email' },
    {
      title: t('columns.role'),
      dataIndex: 'role',
      key: 'role',
      render: (role: string | null) =>
        role ? (
          <Tag color={ROLE_COLORS[role as RoleType] ?? 'default'}>{t(`roles.${role}`, role)}</Tag>
        ) : (
          '—'
        ),
    },
    {
      title: t('columns.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      responsive: ['md'],
      render: (value: string | Date) => date(value),
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'right',
      render: (_, user) => (
        <DataTableRowActions actions={rowActions(user)} label={tc('table.actions')} />
      ),
    },
  ];
}
