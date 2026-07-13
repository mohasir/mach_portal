'use client';
import { Tag, type TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useStaffRowActions } from '../hooks/useStaffRowActions';
import type { Staff } from '../types';

interface UseStaffColumnsParams {
  onEdit: (member: Staff) => void;
  onDelete: (member: Staff) => void;
}

export function useStaffColumns({
  onEdit,
  onDelete,
}: UseStaffColumnsParams): TableColumnsType<Staff> {
  const { t } = useTranslation('staff');
  const { t: tc } = useTranslation('common');
  const { date } = useDateFormatter();
  const rowActions = useStaffRowActions({ onEdit, onDelete });

  return [
    {
      title: t('columns.name'),
      key: 'name',
      render: (_, member) => <AvatarUser name={member.name} email={member.email} />,
    },
    {
      title: t('columns.phone'),
      dataIndex: 'phone',
      key: 'phone',
      responsive: ['lg'],
      render: (phone: string | null) => phone || '—',
    },
    {
      title: t('columns.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'default'}>
          {t(isActive ? 'status.active' : 'status.inactive')}
        </Tag>
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
      render: (_, member) => (
        <DataTableRowActions actions={rowActions(member)} label={tc('table.actions')} />
      ),
    },
  ];
}
