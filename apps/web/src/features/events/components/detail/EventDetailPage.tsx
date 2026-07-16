'use client';
import { useRouter } from 'next/navigation';
import { Button, Skeleton } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useProductCatalog } from '@/features/catalog';
import { PageHeader } from '@/components/shared/PageHeader';
import { useEvent } from '../../hooks/useEvents';
import { EventHeader } from './EventHeader';
import { EventComposition } from './EventComposition';
import { EventPayments } from './EventPayments';
import { EventStaffPanel } from './EventStaffPanel';

interface EventDetailPageProps {
  eventId: string;
}

export function EventDetailPage({ eventId }: EventDetailPageProps) {
  const { t } = useTranslation('events');
  const router = useRouter();
  const { data: event, isLoading: isEventLoading } = useEvent(eventId);
  const { data: catalog, isLoading: isCatalogLoading } = useProductCatalog();

  const title = (
    <div className="flex items-center gap-2">
      <Button
        type="text"
        icon={<ArrowLeft size={18} />}
        onClick={() => router.push('/admin/events')}
        aria-label={t('title')}
      />
      <span>{event?.clientName ?? t('title')}</span>
    </div>
  );

  if (isEventLoading || isCatalogLoading || !event || !catalog) {
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
        <EventHeader event={event} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <EventComposition lines={event.lines} catalog={catalog} />
          <div className="flex flex-col gap-4">
            <EventPayments event={event} />
            <EventStaffPanel event={event} />
          </div>
        </div>
      </div>
    </div>
  );
}
