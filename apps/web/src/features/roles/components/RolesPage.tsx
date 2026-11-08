'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { CreateRoleModal } from './CreateRoleModal';
import { EditRoleModal } from './EditRoleModal';
import { RolesTable } from './RolesTable';

export function RolesPage() {
  const { t } = useTranslation('roles');
  const can = useCan();
  const canCreate = can({ [RESOURCES.ROLE]: [ACTIONS.CREATE] });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title={t('title')}
        backHref="/admin/options"
        actionLabel={canCreate ? t('index.add') : undefined}
        onAction={canCreate ? () => setCreateOpen(true) : undefined}
      />
      <RolesTable onOpen={setOpenRoleId} />
      <CreateRoleModal open={isCreateOpen} onClose={() => setCreateOpen(false)} />
      <EditRoleModal roleId={openRoleId} open={!!openRoleId} onClose={() => setOpenRoleId(null)} />
    </div>
  );
}
