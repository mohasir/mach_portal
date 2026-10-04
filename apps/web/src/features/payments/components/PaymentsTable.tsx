'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button } from 'antd';
import { TbFilter2 } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { paginationOf, type PaymentsListQuery } from '@repo/schemas';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { usePaymentsList } from '../hooks/usePayments';
import type { Payment, PaymentsFilters } from '../types';
import { usePaymentsColumns } from './columns';
import { PaymentRowCard } from './PaymentRowCard';
import { PaymentsFilterChips } from './PaymentsFilterChips';

const EMPTY_FILTERS: PaymentsFilters = {};

/** Filter-bar criteria in use; the date range counts once whichever ends are set. */
const countActiveFilters = ({
  dateFrom,
  dateTo,
  clientIds,
  eventTypeIds,
  methods,
}: PaymentsFilters) =>
  [dateFrom || dateTo, clientIds?.length, eventTypeIds?.length, methods?.length].filter(Boolean)
    .length;

export function PaymentsTable() {
  const { t } = useTranslation('payments');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const [filters, setFilters] = useState<PaymentsFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const table = useDataTable<PaymentsListQuery['sortBy']>({
    defaultSortBy: 'paidAt',
    externalFilters: filters,
  });
  const columns = usePaymentsColumns();

  const { data, isLoading, isPlaceholderData } = usePaymentsList({ ...table.query, ...filters });
  const total = paginationOf(data)?.total;
  const search = table.query.search;
  const activeFilters = countActiveFilters(filters);

  const goToEvent = (row: Payment) => router.push(`/admin/events/${row.eventId}`);
  const setFilter = (patch: Partial<PaymentsFilters>) => setFilters({ ...filters, ...patch });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            loading={isPlaceholderData}
            placeholder={tc('table.search')}
            onSearch={table.tableProps.onSearch}
            className="min-w-0 flex-1 sm:max-w-xs"
          />
          <Badge count={activeFilters} offset={[-5, 5]}>
            <Button
              icon={<TbFilter2 size={18} />}
              type={filtersOpen ? 'primary' : 'default'}
              onClick={() => setFiltersOpen((open) => !open)}
              aria-label={t('filters.title')}
              aria-expanded={filtersOpen}
              className="px-3"
            >
              <span className="hidden sm:inline">{t('filters.title')}</span>
            </Button>
          </Badge>
        </div>

        {filtersOpen && (
          <div className="py-1">
            <PaymentsFilterChips filters={filters} onChange={setFilter} />
          </div>
        )}

        <div className="flex min-h-8 items-center justify-between gap-2">
          {total !== undefined && (
            <span className="text-sm text-gray-500">{tc('table.results', { count: total })}</span>
          )}
          <div className="ml-auto flex items-center gap-4">
            {search && (
              <Button
                type="link"
                className="h-auto px-0 py-1"
                onClick={() => table.tableProps.onSearch('')}
              >
                {tc('table.clearSearch')}
              </Button>
            )}
            {activeFilters > 0 && (
              <Button
                type="link"
                className="h-auto px-0 py-1"
                onClick={() => setFilters(EMPTY_FILTERS)}
              >
                {tc('table.clearFilters')}
              </Button>
            )}
          </div>
        </div>
      </div>

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
