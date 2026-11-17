'use client';
import { useTranslation } from 'react-i18next';
import { paginationOf, type ChargeTypesListQuery } from '@repo/schemas';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import { useChargeTypesList, useToggleChargeTypeActive } from '../hooks/useChargeTypes';
import type { ChargeType } from '../types';
import { ChargeTypeCard } from './ChargeTypeCard';
import { useChargeTypesColumns } from './columns';

interface ChargeTypesTableProps {
  onEdit: (type: ChargeType) => void;
}

export function ChargeTypesTable({ onEdit }: ChargeTypesTableProps) {
  const { t } = useTranslation('chargeTypes');
  const { t: tc } = useTranslation('common');
  const table = useDataTable<ChargeTypesListQuery['sortBy']>({
    defaultSortBy: 'sortOrder',
    defaultSortDir: 'asc',
  });
  const { data, isLoading } = useChargeTypesList(table.query);
  const { toggleActive } = useToggleChargeTypeActive();

  const onToggleActive = (type: ChargeType) =>
    void toggleActive(type.id, !type.isActive).catch(() => {});
  const columns = useChargeTypesColumns({ onEdit, onToggleActive });

  return (
    <DataTable<ChargeType>
      {...table.tableProps}
      rowKey="id"
      columns={columns}
      mobileRenderType="card"
      renderCard={(type) => (
        <ChargeTypeCard type={type} onEdit={onEdit} onToggleActive={onToggleActive} />
      )}
      dataSource={data?.items}
      loading={isLoading}
      total={paginationOf(data)?.total}
      searchPlaceholder={tc('table.search')}
      emptyText={t('empty')}
    />
  );
}
