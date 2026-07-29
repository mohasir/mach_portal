'use client';
import { Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useClient } from '@/features/clients';
import { AvatarUser } from '@/components/shared/AvatarUser';
import type { QuoteDetail } from '../../types';

interface QuoteClientCardProps {
  detail: QuoteDetail;
}

export function QuoteClientCard({ detail }: QuoteClientCardProps) {
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const { data: client } = useClient(detail.clientId ?? undefined);

  return (
    <div>
      <Typography.Title level={4} className="font-heading text-brown m-0! mb-3">
        {t('builder.client.label')}
      </Typography.Title>

      <button
        type="button"
        onClick={() => router.push(`/admin/clients/${detail.clientId}`)}
        className="block w-full text-left"
      >
        <AvatarUser
          name={detail.clientName}
          email={client?.email}
          extra={
            client?.phone ? (
              <Typography.Text type="secondary" className="block truncate text-xs">
                {client.phone}
              </Typography.Text>
            ) : undefined
          }
        />
      </button>
    </div>
  );
}
