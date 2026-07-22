'use client';
import { useTranslation } from 'react-i18next';
import { paginationOf, type EventTypesListQuery } from '@repo/schemas';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import { useEventTypesList } from '../hooks/useEventTypes';
import { useEventTypesColumns } from './columns';
import type { EventType } from '../types';

interface EventTypesTableProps {
  onEdit: (eventType: EventType) => void;
}

export function EventTypesTable({ onEdit }: EventTypesTableProps) {
  const { t } = useTranslation('eventTypes');
  const { t: tc } = useTranslation('common');
  const table = useDataTable<EventTypesListQuery['sortBy']>({ defaultSortBy: 'name' });
  const { data, isLoading } = useEventTypesList(table.query);

  const columns = useEventTypesColumns({ onEdit });

  return (
    <DataTable<EventType>
      {...table.tableProps}
      rowKey="id"
      columns={columns}
      mobileRenderType="list"
      dataSource={data?.items}
      loading={isLoading}
      total={paginationOf(data)?.total}
      searchPlaceholder={tc('table.search')}
      emptyText={t('empty')}
    />
  );
}
