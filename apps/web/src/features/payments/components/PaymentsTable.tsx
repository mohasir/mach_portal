'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { paginationOf, type PaymentsListQuery } from '@repo/schemas';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import { resolveDateRange } from '@/components/shared/FilterChips';
import { FilterToolbar } from '@/components/shared/FilterToolbar';
import { usePaymentsList } from '../hooks/usePayments';
import type { Payment, PaymentsFilters } from '../types';
import { usePaymentsColumns } from './columns';
import { PaymentRowCard } from './PaymentRowCard';
import { PaymentsFilterChips } from './PaymentsFilterChips';

const EMPTY_FILTERS: PaymentsFilters = {};

/** Filter-bar criteria in use; the date range counts once whichever ends are set. */
const countActiveFilters = ({ date, clientIds, eventTypeIds, methods }: PaymentsFilters) =>
  [
    date?.preset || date?.from || date?.to,
    clientIds?.length,
    eventTypeIds?.length,
    methods?.length,
  ].filter(Boolean).length;

export function PaymentsTable() {
  const { t } = useTranslation('payments');
  const router = useRouter();
  const [filters, setFilters] = useState<PaymentsFilters>(EMPTY_FILTERS);
  const table = useDataTable<PaymentsListQuery['sortBy']>({
    defaultSortBy: 'paidAt',
    externalFilters: filters,
  });
  const columns = usePaymentsColumns();

  const { date, ...listFilters } = filters;
  const { from: dateFrom, to: dateTo } = resolveDateRange(date ?? {}, true);
  const { data, isLoading, isPlaceholderData } = usePaymentsList({
    ...table.query,
    ...listFilters,
    dateFrom,
    dateTo,
  });
  const total = paginationOf(data)?.total;
  const search = table.query.search;

  const goToEvent = (row: Payment) => router.push(`/admin/events/${row.eventId}`);
  const setFilter = (patch: Partial<PaymentsFilters>) => setFilters({ ...filters, ...patch });

  return (
    <div className="flex flex-col gap-4">
      <FilterToolbar
        search={search}
        onSearch={table.tableProps.onSearch}
        searching={isPlaceholderData}
        activeFilters={countActiveFilters(filters)}
        onClearFilters={() => setFilters(EMPTY_FILTERS)}
        chips={<PaymentsFilterChips filters={filters} onChange={setFilter} />}
        total={total}
      />

      <DataTable<Payment>
        {...table.tableProps}
        // Search lives in the filter bar above, not in the table.
        onSearch={undefined}
        rowKey="id"
        columns={columns}
        mobileRenderType="card"
        renderCard={(row) => <PaymentRowCard row={row} onClick={() => goToEvent(row)} />}
        onRow={(row) => ({ onClick: () => goToEvent(row), className: 'cursor-pointer' })}
        dataSource={data?.items}
        loading={isLoading}
        total={total}
        // The filter bar above already shows the result count.
        showTotal={false}
        emptyText={t('empty')}
      />
    </div>
  );
}
