'use client';
import { useRouter } from 'next/navigation';
import { Skeleton, Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { useFeature } from '@/lib/auth/useFeature';
import { useClient } from '../../hooks/useClients';
import { visibleClientTabs } from '../../helpers';
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
  const tabKeys = visibleClientTabs({ quotes: useFeature('quotes'), events: useFeature('events') });

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
        {tabKeys.length > 0 && (
          <Tabs
            items={tabKeys.map((key) => ({
              key,
              label: t(`detail.tabs.${key}`),
              children:
                key === 'quotes' ? (
                  <ClientQuotesTab client={client} />
                ) : (
                  <ClientEventsTab client={client} />
                ),
            }))}
          />
        )}
      </div>
    </div>
  );
}
