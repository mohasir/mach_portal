'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { CreateUserModal } from './CreateUserModal';
import { EditUserModal } from './EditUserModal';
import { UsersTable } from './UsersTable';
import type { User } from '../types';

export function UsersPage() {
  const { t } = useTranslation('users');
  const can = useCan();
  const canCreate = can({ user: ['create'] });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  return (
    <div>
      <PageHeader
        title={t('title')}
        actionLabel={canCreate ? t('index.add') : undefined}
        onAction={canCreate ? () => setCreateOpen(true) : undefined}
      />
      <UsersTable onEdit={setEditing} />
      <CreateUserModal open={isCreateOpen} onClose={() => setCreateOpen(false)} />
      <EditUserModal user={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}
