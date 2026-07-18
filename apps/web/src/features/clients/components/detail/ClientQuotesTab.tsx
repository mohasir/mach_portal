'use client';
import { useRouter } from 'next/navigation';
import { Button } from 'antd';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { paginationOf, type QuotesListQuery } from '@repo/schemas';
import { QuoteRowCard, useQuotesColumns, useQuotesList, type Quote } from '@/features/quotes';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import { useCan } from '@/lib/auth/useCan';
import type { ClientDetail } from '../../types';

interface ClientQuotesTabProps {
  client: ClientDetail;
}

export function ClientQuotesTab({ client }: ClientQuotesTabProps) {
  const { t } = useTranslation('quotes');
  const { t: tCommon } = useTranslation('common');
  const { t: tClients } = useTranslation('clients');
  const router = useRouter();
  const can = useCan();
  const table = useDataTable<QuotesListQuery['sortBy']>({ defaultSortBy: 'createdAt' });
  const { data, isLoading } = useQuotesList({ ...table.query, clientId: client.id });
  const columns = useQuotesColumns();

  const onRowClick = (quote: Quote) => router.push(`/admin/quotes/${quote.id}`);
  const onNewQuote = () =>
    router.push(
      `/admin/quotes/new?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`,
    );

  return (
    <div className="flex flex-col gap-4">
      {can({ [RESOURCES.QUOTE]: [ACTIONS.CREATE] }) && (
        <div className="flex justify-end">
          <Button type="primary" icon={<Plus size={16} />} onClick={onNewQuote}>
            {tClients('detail.newQuote')}
          </Button>
        </div>
      )}
      <DataTable<Quote>
        {...table.tableProps}
        rowKey="id"
        columns={columns}
        mobileRenderType="card"
        renderCard={(row) => <QuoteRowCard row={row} onClick={() => onRowClick(row)} />}
        onRow={(row) => ({ onClick: () => onRowClick(row), className: 'cursor-pointer' })}
        dataSource={data?.items}
        loading={isLoading}
        total={paginationOf(data)?.total}
        searchPlaceholder={tCommon('table.search')}
        emptyText={t('empty')}
      />
    </div>
  );
}
