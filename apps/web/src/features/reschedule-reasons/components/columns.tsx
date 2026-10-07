'use client';
import { Tag, type TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useRescheduleReasonRowActions } from '../hooks/useRescheduleReasonRowActions';
import type { RescheduleReason } from '../types';

interface UseRescheduleReasonsColumnsParams {
  onEdit: (reason: RescheduleReason) => void;
  onToggleActive: (reason: RescheduleReason) => void;
}

export function useRescheduleReasonsColumns({
  onEdit,
  onToggleActive,
}: UseRescheduleReasonsColumnsParams): TableColumnsType<RescheduleReason> {
  const { t } = useTranslation('rescheduleReasons');
  const { t: tc } = useTranslation('common');
  const rowActions = useRescheduleReasonRowActions({ onEdit, onToggleActive });

  return [
    {
      title: t('columns.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: true,
    },
    {
      title: t('columns.requiresNote'),
      dataIndex: 'requiresNote',
      key: 'requiresNote',
      responsive: ['md'],
      render: (requiresNote: boolean) =>
        requiresNote ? <Tag color="blue">{tc('yes')}</Tag> : <Tag>{tc('no')}</Tag>,
    },
    {
      title: t('columns.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      sorter: true,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'default'}>
          {isActive ? t('status.active') : t('status.inactive')}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'right',
      render: (_, reason) => (
        <DataTableRowActions actions={rowActions(reason)} label={tc('table.actions')} />
      ),
    },
  ];
}
