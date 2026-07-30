'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { CreateClientModal } from './CreateClientModal';
import { EditClientModal } from './EditClientModal';
import { ClientsTable } from './ClientsTable';
import type { Client } from '../types';

export function ClientsPage() {
  const { t } = useTranslation('clients');
  const can = useCan();
  const canCreate = can({ [RESOURCES.CLIENT]: [ACTIONS.CREATE] });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

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
      <ClientsTable onEdit={setEditing} />
      <CreateClientModal open={isCreateOpen} onClose={() => setCreateOpen(false)} />
      <EditClientModal client={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}
