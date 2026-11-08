'use client';
import { useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/shared/DataTable';
import { useDeleteRole, useDuplicateRole, useRolesList } from '../hooks/useRoles';
import { useRolesColumns } from './columns';
import { RoleCard } from './RoleCard';
import type { Role } from '../types';

interface RolesTableProps {
  onOpen: (roleId: string) => void;
}

// roles.list returns the whole (small) set of a tenant's roles, so search runs on the client.
export function RolesTable({ onOpen }: RolesTableProps) {
  const { t } = useTranslation('roles');
  const { t: tc } = useTranslation('common');
  const { message } = App.useApp();
  const { data, isLoading } = useRolesList();
  const { duplicateRole } = useDuplicateRole();
  const { deleteRole } = useDeleteRole();
  const [search, setSearch] = useState('');

  const open = (role: Role) => onOpen(role.id);
  const onDuplicate = async (role: Role) => {
    try {
      const copy = await duplicateRole(role.id);
      message.success(t('duplicate.success', { name: copy.name }));
      onOpen(copy.id);
    } catch {
      // reported by useApiError
    }
  };
  const onDelete = async (role: Role) => {
    try {
      await deleteRole(role.id);
      message.success(t('delete.success'));
    } catch {
      // reported by useDeleteRole
    }
  };

  const columns = useRolesColumns({ onOpen: open, onDuplicate, onDelete });
  const term = search.trim().toLowerCase();
  const rows = term ? data?.filter((role) => role.name.toLowerCase().includes(term)) : data;

  return (
    <DataTable<Role>
      rowKey="id"
      columns={columns}
      mobileRenderType="card"
      renderCard={(role) => (
        <RoleCard role={role} onOpen={open} onDuplicate={onDuplicate} onDelete={onDelete} />
      )}
      dataSource={rows}
      loading={isLoading}
      onSearch={setSearch}
      searchPlaceholder={tc('table.search')}
      emptyText={t('empty')}
    />
  );
}
