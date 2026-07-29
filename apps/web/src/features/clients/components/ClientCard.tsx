'use client';
import { Card, Flex, Tag, Typography } from 'antd';
import { Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { CLIENT_STATUS_COLORS } from '../helpers';
import { useClientRowActions } from '../hooks/useClientRowActions';
import type { Client } from '../types';

interface ClientCardProps {
  client: Client;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onClick?: () => void;
}

export function ClientCard({ client, onEdit, onDelete, onClick }: ClientCardProps) {
  const { t } = useTranslation('clients');
  const { t: tc } = useTranslation('common');
  const { date } = useDateFormatter();
  const rowActions = useClientRowActions({ onEdit, onDelete });

  return (
    <Card size="small" onClick={onClick} className={onClick ? 'cursor-pointer' : undefined}>
      <div className="flex items-start justify-between gap-3">
        <AvatarUser name={client.name} email={client.email} />
        <div onClick={(e) => e.stopPropagation()}>
          <DataTableRowActions actions={rowActions(client)} label={tc('table.actions')} />
        </div>
      </div>

      <Flex wrap gap={8} align="center" className="mt-3">
        <Tag color={CLIENT_STATUS_COLORS[client.status] ?? 'default'}>
          {t(`status.${client.status}`, client.status)}
        </Tag>
        {client.state ? <Tag>{client.state}</Tag> : null}
        {client.city ? (
          <Typography.Text type="secondary" className="text-xs">
            {client.city}
          </Typography.Text>
        ) : null}
      </Flex>

      {client.phone ? (
        <Typography.Text type="secondary" className="mt-2 flex items-center gap-1 text-xs">
          <Phone size={14} />
          {client.phone}
        </Typography.Text>
      ) : null}
    </Card>
  );
}
