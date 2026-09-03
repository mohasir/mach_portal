'use client';
import { Divider, Empty, Skeleton } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { useCan } from '@/lib/auth/useCan';
import { useEventsList } from '../hooks/useEvents';
import { EventCard } from './EventCard';
import { WrapperCard } from '@/components/shared/WrapperCard';

export function UpcomingEventsCard() {
  const { t } = useTranslation('events');
  const can = useCan();
  const router = useRouter();
  const { data, isLoading } = useEventsList({
    page: 1,
    pageSize: 3,
    sortBy: 'eventDate',
    sortDir: 'asc',
    segment: 'upcoming',
  });

  if (!can({ [RESOURCES.EVENT]: [ACTIONS.READ] })) return null;

  const items = data?.items ?? [];

  return (
    <WrapperCard
      title={t('dashboard.upcomingTitle')}
      extra={
        <Link href="/admin/events" className="text-primary text-sm font-medium">
          {t('dashboard.seeMore')}
        </Link>
      }
    >
      <div className="flex flex-col">
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : items.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('empty')} />
        ) : (
          items.map((event, index) => (
            <div key={event.id}>
              {index > 0 && <Divider className="my-3" />}
              <EventCard
                row={event}
                onClick={() => router.push(`/admin/events/${event.id}`)}
                onAssignStaff={() => {}}
                colorDateBadge="mustard"
                showActions={false}
                showEventType={false}
                variant="plain"
                showCreatedBy={false}
              />
            </div>
          ))
        )}
      </div>
    </WrapperCard>
  );
}
