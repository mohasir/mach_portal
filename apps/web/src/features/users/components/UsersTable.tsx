'use client';
import { Table } from 'antd';
import { useTranslation } from 'react-i18next';
import { useDeleteUser, useUsersList } from '../hooks/useUsers';
import { useUsersColumns } from './columns';
import type { User } from '../types';

interface UsersTableProps {
  onEdit: (user: User) => void;
}

export function UsersTable({ onEdit }: UsersTableProps) {
  const { t } = useTranslation('users');
  const { data: users, isLoading } = useUsersList();
  const { deleteUser } = useDeleteUser();

  const columns = useUsersColumns({ onEdit, onDelete: (user) => deleteUser(user.id) });

  return (
    <Table<User>
      rowKey="id"
      columns={columns}
      dataSource={users}
      loading={isLoading}
      scroll={{ x: 'max-content' }}
      pagination={{ pageSize: 10, hideOnSinglePage: true }}
      locale={{ emptyText: t('empty') }}
    />
  );
}
