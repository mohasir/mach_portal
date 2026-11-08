'use client';
import { Tag, type TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useRoleRowActions } from '../hooks/useRoleRowActions';
import { OwnerRoleTag } from './OwnerRoleTag';
import type { Role } from '../types';

interface UseRolesColumnsParams {
  onOpen: (role: Role) => void;
  onDuplicate: (role: Role) => void;
  onDelete: (role: Role) => void;
}

export function useRolesColumns(params: UseRolesColumnsParams): TableColumnsType<Role> {
  const { t } = useTranslation('roles');
  const { t: tc } = useTranslation('common');
  const { date } = useDateFormatter();
  const rowActions = useRoleRowActions(params);

  return [
    {
      title: t('columns.name'),
      key: 'name',
      render: (_, role) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{role.name}</span>
          {role.isOwner && <OwnerRoleTag />}
        </div>
      ),
    },
    {
      title: t('columns.members'),
      dataIndex: 'memberCount',
      key: 'memberCount',
      align: 'center',
      render: (count: number) => <Tag color={count > 0 ? 'blue' : 'default'}>{count}</Tag>,
    },
    {
      title: t('columns.updatedAt'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      responsive: ['md'],
      render: (value: Role['updatedAt']) => date(value),
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'right',
      render: (_, role) => (
        <DataTableRowActions actions={rowActions(role)} label={tc('table.actions')} />
      ),
    },
  ];
}
