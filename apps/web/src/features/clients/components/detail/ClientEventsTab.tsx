'use client';
import { EventsTable } from '@/features/events';
import type { ClientDetail } from '../../types';

interface ClientEventsTabProps {
  client: ClientDetail;
}

export function ClientEventsTab({ client }: ClientEventsTabProps) {
  return <EventsTable clientId={client.id} />;
}
