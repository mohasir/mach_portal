'use client';
import { Tag, type TableColumnsType } from 'antd';
import { type RoleType } from '@repo/guards';
import { BadgeCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { ROLE_COLORS } from '../helpers';
import { useUserRowActions } from '../hooks/useUserRowActions';
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
  const rowActions = useUserRowActions({ onEdit, onDelete });

  return [
    { title: t('columns.name'), dataIndex: 'name', key: 'name' },
    { title: t('columns.email'), dataIndex: 'email', key: 'email' },
    {
      title: t('columns.emailVerified'),
      dataIndex: 'emailVerified',
      key: 'emailVerified',
      responsive: ['lg'],
      render: (verified: boolean) =>
        verified ? (
          <Tag color="green" icon={<BadgeCheck size={14} />}>
            {tc('yes')}
          </Tag>
        ) : (
          <Tag>{tc('no')}</Tag>
        ),
    },
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
      title: t('columns.sessions'),
      dataIndex: 'sessionsCount',
      key: 'sessionsCount',
      align: 'center',
      responsive: ['lg'],
      render: (n: number) => <Tag color={n > 0 ? 'blue' : 'default'}>{n}</Tag>,
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
