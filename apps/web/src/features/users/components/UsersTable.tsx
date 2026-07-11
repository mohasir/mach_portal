'use client';
import { useTranslation } from 'react-i18next';
import type { UsersListQuery } from '@repo/schemas';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import { useDeleteUser, useUsersList } from '../hooks/useUsers';
import { useUsersColumns } from './columns';
import type { User } from '../types';

interface UsersTableProps {
  onEdit: (user: User) => void;
}

export function UsersTable({ onEdit }: UsersTableProps) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const table = useDataTable<UsersListQuery['sortBy']>({ defaultSortBy: 'createdAt' });
  const { data, isLoading } = useUsersList(table.query);
  const { deleteUser } = useDeleteUser();

  const columns = useUsersColumns({ onEdit, onDelete: (user) => deleteUser(user.id) });

  return (
    <DataTable<User>
      {...table.tableProps}
      rowKey="id"
      columns={columns}
      mobileRenderType="card"
      dataSource={data?.items}
      loading={isLoading}
      total={data?.pagination.total}
      searchPlaceholder={tc('table.search')}
      emptyText={t('empty')}
    />
  );
}
