'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { CreateEventTypeModal } from './CreateEventTypeModal';
import { EditEventTypeModal } from './EditEventTypeModal';
import { EventTypesTable } from './EventTypesTable';
import type { EventType } from '../types';

export function EventTypesPage() {
  const { t } = useTranslation('eventTypes');
  const can = useCan();
  const canCreate = can({ [RESOURCES.EVENT_TYPE]: [ACTIONS.CREATE] });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<EventType | null>(null);

  return (
    <div>
      <PageHeader
        title={t('title')}
        backHref="/admin/options"
        actionLabel={canCreate ? t('index.add') : undefined}
        onAction={canCreate ? () => setCreateOpen(true) : undefined}
        mobileAction={
          canCreate
            ? { icon: Plus, onClick: () => setCreateOpen(true), ariaLabel: t('index.add') }
            : undefined
        }
      />
      <EventTypesTable onEdit={setEditing} />
      <CreateEventTypeModal open={isCreateOpen} onClose={() => setCreateOpen(false)} />
      <EditEventTypeModal eventType={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}
