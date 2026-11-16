'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import type { UnitOfMeasure } from '../types';
import { CreateUnitModal } from './CreateUnitModal';
import { EditUnitModal } from './EditUnitModal';
import { UnitsTable } from './UnitsTable';

export function UnitsOfMeasurePage() {
  const { t } = useTranslation('unitsOfMeasure');
  const can = useCan();
  const canCreate = can({ [RESOURCES.UNIT_OF_MEASURE]: [ACTIONS.CREATE] });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UnitOfMeasure | null>(null);

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
      <UnitsTable onEdit={setEditing} />
      <CreateUnitModal open={isCreateOpen} onClose={() => setCreateOpen(false)} />
      <EditUnitModal unit={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}
