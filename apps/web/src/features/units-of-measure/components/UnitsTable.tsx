'use client';
import { useTranslation } from 'react-i18next';
import { paginationOf, type UnitsOfMeasureListQuery } from '@repo/schemas';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import { useToggleUnitActive, useUnitsOfMeasureList } from '../hooks/useUnitsOfMeasure';
import type { UnitOfMeasure } from '../types';
import { useUnitsColumns } from './columns';
import { UnitCard } from './UnitCard';

interface UnitsTableProps {
  onEdit: (unit: UnitOfMeasure) => void;
}

export function UnitsTable({ onEdit }: UnitsTableProps) {
  const { t } = useTranslation('unitsOfMeasure');
  const { t: tc } = useTranslation('common');
  const table = useDataTable<UnitsOfMeasureListQuery['sortBy']>({
    defaultSortBy: 'sortOrder',
    defaultSortDir: 'asc',
  });
  const { data, isLoading } = useUnitsOfMeasureList(table.query);
  const { toggleActive } = useToggleUnitActive();

  const onToggleActive = (unit: UnitOfMeasure) =>
    void toggleActive(unit.id, !unit.isActive).catch(() => {});
  const columns = useUnitsColumns({ onEdit, onToggleActive });

  return (
    <DataTable<UnitOfMeasure>
      {...table.tableProps}
      rowKey="id"
      columns={columns}
      mobileRenderType="card"
      renderCard={(unit) => (
        <UnitCard unit={unit} onEdit={onEdit} onToggleActive={onToggleActive} />
      )}
      dataSource={data?.items}
      loading={isLoading}
      total={paginationOf(data)?.total}
      searchPlaceholder={tc('table.search')}
      emptyText={t('empty')}
    />
  );
}
