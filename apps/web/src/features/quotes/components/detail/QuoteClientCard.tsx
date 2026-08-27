'use client';
import { Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useClient } from '@/features/clients';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { FormattedPhone } from '@/components/shared/Inputs/PhoneInput';
import { WrapperCard } from '@/components/shared/WrapperCard';
import type { QuoteDetail } from '../../types';

interface QuoteClientCardProps {
  detail: QuoteDetail;
  variant?: 'card' | 'plain';
}

export function QuoteClientCard({ detail, variant }: QuoteClientCardProps) {
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const { data: client } = useClient(detail.clientId ?? undefined);

  return (
    <WrapperCard variant={variant} title={t('builder.client.label')}>
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
                <FormattedPhone value={client.phone} />
              </Typography.Text>
            ) : undefined
          }
        />
      </button>
    </WrapperCard>
  );
}
