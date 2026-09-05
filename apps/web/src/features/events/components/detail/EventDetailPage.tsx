'use client';
import { useRouter } from 'next/navigation';
import { Skeleton, Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { useProductCatalog } from '@/features/catalog';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { useEvent } from '../../hooks/useEvents';
import type { EventDetail } from '../../types';
import { EventAttachments } from './EventAttachments';
import { EventHeader } from './EventHeader';
import { EventComposition } from './EventComposition';
import { EventHistoryCard } from './EventHistoryCard';
import { EventPayments, type EventDetailWithPayments } from './EventPayments';
import { EventStaffPanel } from './EventStaffPanel';
import { WrapperCard } from '@/components/shared/WrapperCard';

interface EventDetailPageProps {
  eventId: string;
}

function hasPaymentsData(event: EventDetail): event is EventDetailWithPayments {
  return event.payments !== null;
}

function hasHistoryData(
  event: EventDetail,
): event is EventDetail & { history: NonNullable<EventDetail['history']> } {
  return event.history !== null;
}

export function EventDetailPage({ eventId }: EventDetailPageProps) {
  const { t } = useTranslation('events');
  const router = useRouter();
  const can = useCan();
  const { data: event, isLoading: isEventLoading } = useEvent(eventId);
  const { data: catalog, isLoading: isCatalogLoading } = useProductCatalog();

  const title = event?.clientName ?? t('title');
  const onBack = () => router.push('/admin/events');

  if (isEventLoading || isCatalogLoading || !event || !catalog) {
    return (
      <div>
        <PageHeader title={title} onBack={onBack} />
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  const canViewPayments = can({ [RESOURCES.PAYMENT]: [ACTIONS.READ] });

  const tabItems = [
    {
      key: 'services',
      label: t('detail.tabs.services'),
      children: <EventComposition event={event} lines={event.lines} catalog={catalog} />,
    },
    {
      key: 'staff',
      label: t('detail.tabs.staff'),
      children: <EventStaffPanel event={event} />,
    },
    canViewPayments &&
      hasPaymentsData(event) && {
        key: 'payments',
        label: t('detail.tabs.payments'),
        children: <EventPayments event={event} />,
      },
    canViewPayments &&
      hasPaymentsData(event) && {
        key: 'attachments',
        label: t('detail.tabs.attachments'),
        children: <EventAttachments event={event} />,
      },
  ].filter((item) => !!item);

  return (
    <div>
      <PageHeader title={title} onBack={onBack} />
      <div className="flex flex-col gap-4">
        <EventHeader event={event} />
        <WrapperCard>
          <Tabs items={tabItems} />
        </WrapperCard>
        {hasHistoryData(event) && <EventHistoryCard history={event.history} />}
      </div>
    </div>
  );
}
