'use client';
import { Flex, Tag, type TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ClientStatus } from '@repo/schemas';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { FormattedPhone } from '@/components/shared/Inputs/PhoneInput';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { CLIENT_STATUS_COLORS } from '../helpers';
import { useClientRowActions } from '../hooks/useClientRowActions';
import type { Client } from '../types';

interface UseClientsColumnsParams {
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
}

export function useClientsColumns({
  onEdit,
  onDelete,
}: UseClientsColumnsParams): TableColumnsType<Client> {
  const { t } = useTranslation('clients');
  const { t: tc } = useTranslation('common');
  const { date } = useDateFormatter();
  const rowActions = useClientRowActions({ onEdit, onDelete });

  return [
    {
      title: t('columns.name'),
      key: 'name',
      render: (_, client) => <AvatarUser name={client.name} email={client.email} />,
    },
    {
      title: t('columns.phone'),
      dataIndex: 'phone',
      key: 'phone',
      responsive: ['lg'],
      render: (phone: string | null) => (phone ? <FormattedPhone value={phone} /> : '—'),
    },
    {
      title: t('columns.location'),
      key: 'location',
      responsive: ['md'],
      render: (_, client) =>
        client.city || client.state ? (
          <Flex gap={6} align="center" wrap>
            {client.city ? <span>{client.city}</span> : null}
            {client.state ? <Tag>{client.state}</Tag> : null}
          </Flex>
        ) : (
          '—'
        ),
    },
    {
      title: t('columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: ClientStatus) => (
        <Tag color={CLIENT_STATUS_COLORS[status] ?? 'default'}>{t(`status.${status}`, status)}</Tag>
      ),
    },
    {
      title: t('columns.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      responsive: ['md'],
      render: (value: string | Date) => date(value),
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'right',
      render: (_, client) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DataTableRowActions actions={rowActions(client)} label={tc('table.actions')} />
        </div>
      ),
    },
  ];
}
