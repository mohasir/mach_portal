'use client';
import { useRouter } from 'next/navigation';
import { Button, Skeleton, Tabs } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { useClient } from '../../hooks/useClients';
import { ClientInfoCard } from './ClientInfoCard';
import { ClientQuotesTab } from './ClientQuotesTab';
import { ClientEventsTab } from './ClientEventsTab';

interface ClientDetailPageProps {
  clientId: string;
}

export function ClientDetailPage({ clientId }: ClientDetailPageProps) {
  const { t } = useTranslation('clients');
  const router = useRouter();
  const { data: client, isLoading } = useClient(clientId);

  const title = (
    <div className="flex items-center gap-2">
      <Button
        type="text"
        icon={<ArrowLeft size={18} />}
        onClick={() => router.push('/admin/clients')}
        aria-label={t('title')}
      />
      <span>{client?.name ?? t('title')}</span>
    </div>
  );

  if (isLoading || !client) {
    return (
      <div>
        <PageHeader title={title} />
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} />
      <div className="flex flex-col gap-4">
        <ClientInfoCard client={client} />
        <Tabs
          items={[
            {
              key: 'quotes',
              label: t('detail.tabs.quotes'),
              children: <ClientQuotesTab client={client} />,
            },
            {
              key: 'events',
              label: t('detail.tabs.events'),
              children: <ClientEventsTab client={client} />,
            },
          ]}
        />
      </div>
    </div>
  );
}
