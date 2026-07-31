'use client';
import { useState } from 'react';
import { Button, Card, Flex, Tag, Typography } from 'antd';
import { Mail, MapPin, Pencil, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { useCan } from '@/lib/auth/useCan';
import { CLIENT_STATUS_COLORS } from '../../helpers';
import { EditClientModal } from '../EditClientModal';
import type { ClientDetail } from '../../types';

interface ClientInfoCardProps {
  client: ClientDetail;
}

export function ClientInfoCard({ client }: ClientInfoCardProps) {
  const { t } = useTranslation('clients');
  const can = useCan();
  const [isEditing, setEditing] = useState(false);

  return (
    <Card size="small">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <AvatarUser name={client.name} size={48} />

        {can({ [RESOURCES.CLIENT]: [ACTIONS.UPDATE] }) && (
          <Button icon={<Pencil size={14} />} onClick={() => setEditing(true)}>
            {t('detail.edit')}
          </Button>
        )}
      </div>

      <Flex wrap gap={8} align="center" className="mt-3">
        <Tag color={CLIENT_STATUS_COLORS[client.status] ?? 'default'}>
          {t(`status.${client.status}`, client.status)}
        </Tag>
        {client.state ? <Tag>{client.state}</Tag> : null}
      </Flex>

      <div className="mt-3 flex flex-col gap-1">
        {client.email && (
          <Typography.Text type="secondary" className="flex items-center gap-2 text-base">
            <Mail size={14} /> {client.email}
          </Typography.Text>
        )}
        {client.phone && (
          <Typography.Text type="secondary" className="flex items-center gap-2 text-base">
            <Phone size={14} /> {client.phone}
          </Typography.Text>
        )}
        {(client.address || client.city) && (
          <Typography.Text type="secondary" className="flex items-center gap-2 text-base">
            <MapPin size={14} />
            {[client.address, client.city].filter(Boolean).join(', ')}
          </Typography.Text>
        )}
      </div>

      {client.notes && (
        <Typography.Text type="secondary" className="mt-3 block text-xs whitespace-pre-line">
          {client.notes}
        </Typography.Text>
      )}

      <EditClientModal client={client} open={isEditing} onClose={() => setEditing(false)} />
    </Card>
  );
}
