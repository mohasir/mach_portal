'use client';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { paginationOf, type QuotesListQuery } from '@repo/schemas';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import { useQuotesList } from '../../hooks/useQuotes';
import { useQuotesColumns } from './columns';
import { QuoteRowCard } from './QuoteRowCard';
import type { Quote, QuotesPageFilters } from '../../types';

interface QuotesTableProps {
  filters: QuotesPageFilters;
  onRowClick: (quote: Quote) => void;
  /** True while the previous results are still shown for a new search/filter/page. */
  onSearchingChange?: (searching: boolean) => void;
  onTotalChange?: (total: number | undefined) => void;
}

export function QuotesTable({
  filters,
  onRowClick,
  onSearchingChange,
  onTotalChange,
}: QuotesTableProps) {
  const { t } = useTranslation('quotes');
  const table = useDataTable<QuotesListQuery['sortBy']>({
    defaultSortBy: 'createdAt',
    externalFilters: filters,
  });

  const { data, isLoading, isPlaceholderData } = useQuotesList({ ...table.query, ...filters });

  useEffect(() => {
    onSearchingChange?.(isPlaceholderData);
    return () => onSearchingChange?.(false);
  }, [isPlaceholderData, onSearchingChange]);

  const total = paginationOf(data)?.total;
  useEffect(() => {
    onTotalChange?.(total);
    return () => onTotalChange?.(undefined);
  }, [total, onTotalChange]);

  const columns = useQuotesColumns();

  return (
    <DataTable<Quote>
      {...table.tableProps}
      // Search lives in the page's filter bar (shared with the pipeline), not in the table.
      onSearch={undefined}
      rowKey="id"
      columns={columns}
      mobileRenderType="card"
      renderCard={(row) => <QuoteRowCard row={row} onClick={() => onRowClick(row)} />}
      onRow={(row) => ({ onClick: () => onRowClick(row), className: 'cursor-pointer' })}
      dataSource={data?.items}
      loading={isLoading}
      total={total}
      // The page's filter bar already shows the result count for both views.
      showTotal={false}
      emptyText={t('empty')}
    />
  );
}
