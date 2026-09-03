'use client';
import { Tag, type TableColumnsType } from 'antd';
import { BadgeCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { RoleTag } from '@/components/shared/RoleTag';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useUserRowActions } from '../hooks/useUserRowActions';
import type { User } from '../types';

interface UseUsersColumnsParams {
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onPasswordSetupLink: (
    url: string,
    name: string,
    email: string,
    reason: 'create' | 'reset',
  ) => void;
}

export function useUsersColumns({
  onEdit,
  onDelete,
  onPasswordSetupLink,
}: UseUsersColumnsParams): TableColumnsType<User> {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const { date } = useDateFormatter();
  const rowActions = useUserRowActions({ onEdit, onDelete, onPasswordSetupLink });

  return [
    {
      title: t('columns.name'),
      key: 'name',
      render: (_, user) => (
        <AvatarUser
          name={user.name}
          email={user.email}
          extra={
            user.mustChangePassword ? (
              <Tag color="orange" className="mt-1">
                {t('pending.badge')}
              </Tag>
            ) : undefined
          }
        />
      ),
    },
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
      render: (role: string | null) => (role ? <RoleTag role={role} /> : '—'),
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
