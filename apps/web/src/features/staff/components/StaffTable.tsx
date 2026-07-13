'use client';
import { useTranslation } from 'react-i18next';
import type { StaffListQuery } from '@repo/schemas';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import { useDeleteStaff, useStaffList } from '../hooks/useStaff';
import { useStaffColumns } from './columns';
import { StaffCard } from './StaffCard';
import type { Staff } from '../types';

interface StaffTableProps {
  onEdit: (member: Staff) => void;
}

export function StaffTable({ onEdit }: StaffTableProps) {
  const { t } = useTranslation('staff');
  const { t: tc } = useTranslation('common');
  const table = useDataTable<StaffListQuery['sortBy']>({ defaultSortBy: 'createdAt' });
  const { data, isLoading } = useStaffList(table.query);
  const { deleteStaff } = useDeleteStaff();

  const onDelete = (member: Staff) => deleteStaff(member.id);
  const columns = useStaffColumns({ onEdit, onDelete });

  return (
    <DataTable<Staff>
      {...table.tableProps}
      rowKey="id"
      columns={columns}
      mobileRenderType="card"
      renderCard={(member) => <StaffCard member={member} onEdit={onEdit} onDelete={onDelete} />}
      dataSource={data?.items}
      loading={isLoading}
      total={data?.pagination.total}
      searchPlaceholder={tc('table.search')}
      emptyText={t('empty')}
    />
  );
}
