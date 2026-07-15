'use client';
import { useState } from 'react';
import { Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { QUOTE_STAGES, stateSchema, type QuotesListQuery } from '@repo/schemas';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import { useQuotesList } from '../../hooks/useQuotes';
import { useQuotesColumns } from './columns';
import { QuoteRowCard } from './QuoteRowCard';
import type { Quote } from '../../types';

interface QuotesTableProps {
  onRowClick: (quote: Quote) => void;
}

export function QuotesTable({ onRowClick }: QuotesTableProps) {
  const { t } = useTranslation('quotes');
  const { t: tc } = useTranslation('common');
  const table = useDataTable<QuotesListQuery['sortBy']>({ defaultSortBy: 'createdAt' });
  const [stage, setStage] = useState<QuotesListQuery['stage']>();
  const [state, setState] = useState<QuotesListQuery['state']>();

  const { data, isLoading } = useQuotesList({ ...table.query, stage, state });
  const columns = useQuotesColumns();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          allowClear
          placeholder={t('filters.stage')}
          className="w-full sm:w-52"
          value={stage}
          onChange={setStage}
          options={QUOTE_STAGES.map((s) => ({ value: s, label: t(`stage.${s}`) }))}
        />
        <Select
          allowClear
          placeholder={t('filters.state')}
          className="w-full sm:w-32"
          value={state}
          onChange={setState}
          options={stateSchema.options.map((s) => ({ value: s, label: s }))}
        />
      </div>
      <DataTable<Quote>
        {...table.tableProps}
        rowKey="id"
        columns={columns}
        mobileRenderType="card"
        renderCard={(row) => <QuoteRowCard row={row} onClick={() => onRowClick(row)} />}
        onRow={(row) => ({ onClick: () => onRowClick(row), className: 'cursor-pointer' })}
        dataSource={data?.items}
        loading={isLoading}
        total={data?.pagination.total}
        searchPlaceholder={tc('table.search')}
        emptyText={t('empty')}
      />
    </div>
  );
}
