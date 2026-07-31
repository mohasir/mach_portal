'use client';
import { useState } from 'react';
import { Empty, Skeleton, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { useCan } from '@/lib/auth/useCan';
import { AssignStaffModal } from '@/features/quotes/components/pipeline/AssignStaffModal';
import { useEventsList } from '../hooks/useEvents';
import { EventCard } from './EventCard';
import type { Event } from '../types';

export function UpcomingEventsCard() {
  const { t } = useTranslation('events');
  const can = useCan();
  const router = useRouter();
  const [assigningEvent, setAssigningEvent] = useState<Event | null>(null);
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
    <>
      <div className="flex items-center justify-between gap-2 px-2">
        <Typography.Title level={4} className="font-heading text-brown m-0!">
          {t('dashboard.upcomingTitle')}
        </Typography.Title>
        <Link href="/admin/events" className="text-primary text-sm font-medium">
          {t('dashboard.seeMore')}
        </Link>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : items.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('empty')} />
        ) : (
          items.map((event, index) => (
            <EventCard
              key={event.id}
              row={event}
              index={index}
              onClick={() => router.push(`/admin/events/${event.id}`)}
              onAssignStaff={setAssigningEvent}
            />
          ))
        )}
      </div>
      <AssignStaffModal
        eventId={assigningEvent?.id ?? null}
        eventDate={assigningEvent?.eventDate ?? null}
        open={!!assigningEvent}
        onClose={() => setAssigningEvent(null)}
      />
    </>
  );
}
