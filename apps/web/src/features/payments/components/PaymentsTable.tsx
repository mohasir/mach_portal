'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from 'antd';
import { ListFilter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { paginationOf, type PaymentsListQuery } from '@repo/schemas';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import { usePaymentsList } from '../hooks/usePayments';
import type { Payment } from '../types';
import { usePaymentsColumns } from './columns';
import { PaymentRowCard } from './PaymentRowCard';
import { PaymentsFilters, type PaymentsFiltersValue } from './PaymentsFilters';

const EMPTY_FILTERS: PaymentsFiltersValue = {};

export function PaymentsTable() {
  const { t } = useTranslation('payments');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const table = useDataTable<PaymentsListQuery['sortBy']>({ defaultSortBy: 'paidAt' });
  const [filters, setFilters] = useState<PaymentsFiltersValue>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<PaymentsFiltersValue>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const columns = usePaymentsColumns();

  const [searchValue, setSearchValue] = useState('');

  const { data, isLoading } = usePaymentsList({
    ...table.query,
    dateFrom: filters.dateFrom?.format('YYYY-MM-DD'),
    dateTo: filters.dateTo?.format('YYYY-MM-DD'),
    clientId: filters.clientId,
    eventTypeId: filters.eventTypeId,
    method: filters.method,
  });

  const goToEvent = (row: Payment) => router.push(`/admin/events/${row.eventId}`);

  const openFilters = () => {
    setDraftFilters(filters);
    setFiltersOpen(true);
  };
  const applyFilters = () => {
    setFilters(draftFilters);
    setFiltersOpen(false);
  };

  const hasActiveFilters =
    !!table.query.search ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    !!filters.clientId ||
    !!filters.eventTypeId ||
    !!filters.method;

  const clearFilters = () => {
    setSearchValue('');
    table.tableProps.onSearch('');
    setFilters(EMPTY_FILTERS);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input.Search
          allowClear
          placeholder={tc('table.search')}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onSearch={table.tableProps.onSearch}
          className="flex-1"
        />
        <Button
          icon={<ListFilter size={16} />}
          onClick={openFilters}
          aria-label={t('filters.title')}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {tc('table.results', { count: paginationOf(data)?.total ?? 0 })}
        </span>
        {hasActiveFilters && (
          <Button type="link" className="px-0" onClick={clearFilters}>
            {tc('table.clearFilters')}
          </Button>
        )}
      </div>
      <DataTable<Payment>
        {...table.tableProps}
        onSearch={undefined}
        showTotal={false}
        rowKey="id"
        columns={columns}
        mobileRenderType="card"
        renderCard={(row) => <PaymentRowCard row={row} onClick={() => goToEvent(row)} />}
        onRow={(row) => ({ onClick: () => goToEvent(row), className: 'cursor-pointer' })}
        dataSource={data?.items}
        loading={isLoading}
        total={paginationOf(data)?.total}
        emptyText={t('empty')}
      />

      <BottomSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t('filters.title')}
      >
        <div className="flex flex-col gap-4 px-2">
          <PaymentsFilters value={draftFilters} onChange={setDraftFilters} />
          <Button type="primary" block onClick={applyFilters}>
            {t('filters.apply')}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
