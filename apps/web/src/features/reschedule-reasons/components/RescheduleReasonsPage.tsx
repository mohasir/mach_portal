'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { CreateRescheduleReasonModal } from './CreateRescheduleReasonModal';
import { EditRescheduleReasonModal } from './EditRescheduleReasonModal';
import { RescheduleReasonsTable } from './RescheduleReasonsTable';
import type { RescheduleReason } from '../types';

export function RescheduleReasonsPage() {
  const { t } = useTranslation('rescheduleReasons');
  const can = useCan();
  const canCreate = can({ [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.CREATE] });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RescheduleReason | null>(null);

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
      <RescheduleReasonsTable onEdit={setEditing} />
      <CreateRescheduleReasonModal open={isCreateOpen} onClose={() => setCreateOpen(false)} />
      <EditRescheduleReasonModal
        reason={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
