'use client';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { EventsTable } from './EventsTable';

export function EventsPage() {
  const { t } = useTranslation('admin');

  return (
    <div>
      <PageHeader title={t('nav.events')} backHref="/admin/options" />
      <EventsTable />
    </div>
  );
}
