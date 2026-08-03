'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { paginationOf, type PaymentsListQuery } from '@repo/schemas';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import { usePaymentsList } from '../hooks/usePayments';
import type { Payment } from '../types';
import { usePaymentsColumns } from './columns';
import { PaymentRowCard } from './PaymentRowCard';
import { PaymentsFilters, type PaymentsFiltersValue } from './PaymentsFilters';

export function PaymentsTable() {
  const { t } = useTranslation('payments');
  const router = useRouter();
  const table = useDataTable<PaymentsListQuery['sortBy']>({ defaultSortBy: 'paidAt' });
  const [filters, setFilters] = useState<PaymentsFiltersValue>({ dateRange: null });
  const columns = usePaymentsColumns();

  const { data, isLoading } = usePaymentsList({
    ...table.query,
    dateFrom: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
    dateTo: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
    clientId: filters.clientId,
    eventTypeId: filters.eventTypeId,
    method: filters.method,
  });

  const goToEvent = (row: Payment) => router.push(`/admin/events/${row.eventId}`);

  return (
    <div className="flex flex-col gap-4">
      <PaymentsFilters value={filters} onChange={setFilters} />
      <DataTable<Payment>
        {...table.tableProps}
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
    </div>
  );
}
