'use client';
import { useRouter } from 'next/navigation';
import { Skeleton, Tabs } from 'antd';
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

  const title = client?.name ?? t('title');
  const onBack = () => router.push('/admin/clients');

  if (isLoading || !client) {
    return (
      <div>
        <PageHeader title={title} onBack={onBack} />
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} onBack={onBack} />
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
