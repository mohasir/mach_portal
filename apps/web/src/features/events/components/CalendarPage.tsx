'use client';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { EventsCalendar } from './calendar/EventsCalendar';

export function CalendarPage() {
  const { t } = useTranslation('admin');

  return (
    <div>
      <PageHeader title={t('nav.calendarTab')} />
      <EventsCalendar />
    </div>
  );
}
