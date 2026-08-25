'use client';
import { useTranslation } from 'react-i18next';
import { paginationOf, type UsersListQuery } from '@repo/schemas';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import { useDeleteUser, useUsersList } from '../hooks/useUsers';
import { useUsersColumns } from './columns';
import { UserCard } from './UserCard';
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

  const onDelete = (user: User) => deleteUser(user.id);
  const columns = useUsersColumns({ onEdit, onDelete });

  return (
    <DataTable<User>
      {...table.tableProps}
      rowKey="id"
      columns={columns}
      mobileRenderType="card"
      renderCard={(user) => <UserCard user={user} onEdit={onEdit} onDelete={onDelete} />}
      dataSource={data?.items}
      loading={isLoading}
      total={paginationOf(data)?.total}
      searchPlaceholder={tc('table.search')}
      emptyText={t('empty')}
    />
  );
}
