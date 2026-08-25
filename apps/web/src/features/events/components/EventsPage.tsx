'use client';
import { useState } from 'react';
import { Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import type { EventsSegment } from '@repo/schemas';
import { PageHeader } from '@/components/shared/PageHeader';
import { useEventsSegmentCounts } from '../hooks/useEvents';
import { EventsTable } from './EventsTable';

export function EventsPage() {
  const { t } = useTranslation('admin');
  const { t: te } = useTranslation('events');
  const [segment, setSegment] = useState<EventsSegment>('upcoming');
  const counts = useEventsSegmentCounts();

  return (
    <div>
      <PageHeader title={t('nav.events')} backHref="/admin/options" />
      <Segmented
        className="mb-4"
        block
        value={segment}
        onChange={(value) => setSegment(value as EventsSegment)}
        options={[
          { label: `${te('segment.upcoming')} (${counts.upcoming})`, value: 'upcoming' },
          { label: `${te('segment.past')} (${counts.past})`, value: 'past' },
          { label: `${te('segment.all')} (${counts.all})`, value: 'all' },
        ]}
      />
      <EventsTable key={segment} segment={segment} />
    </div>
  );
}
