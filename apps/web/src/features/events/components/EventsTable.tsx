'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { paginationOf, type EventsListQuery, type EventsSegment } from '@repo/schemas';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import { AssignStaffModal } from '@/features/quotes/components/pipeline/AssignStaffModal';
import { useEventsList } from '../hooks/useEvents';
import { useEventsColumns } from './columns';
import { EventCard } from './EventCard';
import type { Event } from '../types';

interface EventsTableProps {
  clientId?: string;
  segment?: EventsSegment;
}

export function EventsTable({ clientId, segment = 'all' }: EventsTableProps) {
  const { t } = useTranslation('events');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const table = useDataTable<EventsListQuery['sortBy']>({ defaultSortBy: 'eventDate' });
  const { data, isLoading } = useEventsList({ ...table.query, clientId, segment });
  const [assigningEvent, setAssigningEvent] = useState<Event | null>(null);
  const columns = useEventsColumns({ onAssignStaff: setAssigningEvent });

  const onRowClick = (row: Event) => router.push(`/admin/events/${row.id}`);

  return (
    <>
      <DataTable<Event>
        {...table.tableProps}
        rowKey="id"
        columns={columns}
        mobileRenderType="card"
        renderCard={(row, index) => (
          <EventCard
            row={row}
            index={index}
            onClick={() => onRowClick(row)}
            onAssignStaff={setAssigningEvent}
          />
        )}
        onRow={(row) => ({ onClick: () => onRowClick(row), className: 'cursor-pointer' })}
        dataSource={data?.items}
        loading={isLoading}
        total={paginationOf(data)?.total}
        searchPlaceholder={tc('table.search')}
        emptyText={t('empty')}
      />
      <AssignStaffModal
        eventId={assigningEvent?.id ?? null}
        eventDate={assigningEvent?.eventDate ?? null}
        open={!!assigningEvent}
        onClose={() => setAssigningEvent(null)}
      />
    </>
  );
}
