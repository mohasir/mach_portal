'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { CreateStaffModal } from './CreateStaffModal';
import { EditStaffModal } from './EditStaffModal';
import { StaffTable } from './StaffTable';
import type { Staff } from '../types';

export function StaffPage() {
  const { t } = useTranslation('staff');
  const can = useCan();
  const canCreate = can({ [RESOURCES.STAFF]: [ACTIONS.CREATE] });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);

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
      <StaffTable onEdit={setEditing} />
      <CreateStaffModal open={isCreateOpen} onClose={() => setCreateOpen(false)} />
      <EditStaffModal member={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}
