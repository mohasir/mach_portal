'use client';
import { useTranslation } from 'react-i18next';
import { paginationOf, type RescheduleReasonsListQuery } from '@repo/schemas';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import {
  useRescheduleReasonsList,
  useToggleRescheduleReasonActive,
} from '../hooks/useRescheduleReasons';
import { useRescheduleReasonsColumns } from './columns';
import { RescheduleReasonCard } from './RescheduleReasonCard';
import type { RescheduleReason } from '../types';

interface RescheduleReasonsTableProps {
  onEdit: (reason: RescheduleReason) => void;
}

export function RescheduleReasonsTable({ onEdit }: RescheduleReasonsTableProps) {
  const { t } = useTranslation('rescheduleReasons');
  const { t: tc } = useTranslation('common');
  const table = useDataTable<RescheduleReasonsListQuery['sortBy']>({ defaultSortBy: 'sortOrder' });
  const { data, isLoading } = useRescheduleReasonsList(table.query);
  const { toggleActive } = useToggleRescheduleReasonActive();

  const onToggleActive = (reason: RescheduleReason) =>
    void toggleActive(reason.id, !reason.isActive).catch(() => {});
  const columns = useRescheduleReasonsColumns({ onEdit, onToggleActive });

  return (
    <DataTable<RescheduleReason>
      {...table.tableProps}
      rowKey="id"
      columns={columns}
      mobileRenderType="card"
      renderCard={(reason) => (
        <RescheduleReasonCard reason={reason} onEdit={onEdit} onToggleActive={onToggleActive} />
      )}
      dataSource={data?.items}
      loading={isLoading}
      total={paginationOf(data)?.total}
      searchPlaceholder={tc('table.search')}
      emptyText={t('empty')}
    />
  );
}
