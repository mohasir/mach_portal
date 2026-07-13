'use client';
import { useTranslation } from 'react-i18next';
import type { ClientsListQuery } from '@repo/schemas';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import { useClientsList, useDeleteClient } from '../hooks/useClients';
import { useClientsColumns } from './columns';
import { ClientCard } from './ClientCard';
import type { Client } from '../types';

interface ClientsTableProps {
  onEdit: (client: Client) => void;
}

export function ClientsTable({ onEdit }: ClientsTableProps) {
  const { t } = useTranslation('clients');
  const { t: tc } = useTranslation('common');
  const table = useDataTable<ClientsListQuery['sortBy']>({ defaultSortBy: 'createdAt' });
  const { data, isLoading } = useClientsList(table.query);
  const { deleteClient } = useDeleteClient();

  const onDelete = (client: Client) => deleteClient(client.id);
  const columns = useClientsColumns({ onEdit, onDelete });

  return (
    <DataTable<Client>
      {...table.tableProps}
      rowKey="id"
      columns={columns}
      mobileRenderType="card"
      renderCard={(client) => <ClientCard client={client} onEdit={onEdit} onDelete={onDelete} />}
      dataSource={data?.items}
      loading={isLoading}
      total={data?.pagination.total}
      searchPlaceholder={tc('table.search')}
      emptyText={t('empty')}
    />
  );
}
