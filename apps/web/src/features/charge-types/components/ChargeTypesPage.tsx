'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import type { ChargeType } from '../types';
import { ChargeTypesTable } from './ChargeTypesTable';
import { CreateChargeTypeModal } from './CreateChargeTypeModal';
import { EditChargeTypeModal } from './EditChargeTypeModal';

export function ChargeTypesPage() {
  const { t } = useTranslation('chargeTypes');
  const can = useCan();
  const canCreate = can({ [RESOURCES.CHARGE_TYPE]: [ACTIONS.CREATE] });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ChargeType | null>(null);

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
      <ChargeTypesTable onEdit={setEditing} />
      <CreateChargeTypeModal open={isCreateOpen} onClose={() => setCreateOpen(false)} />
      <EditChargeTypeModal type={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}
