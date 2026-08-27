'use client';
import { Fragment, useState } from 'react';
import { Divider, Typography } from 'antd';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { useCan } from '@/lib/auth/useCan';
import { useOptionGroupMutations } from '../hooks/useOptionGroupMutations';
import { SortableList } from './SortableList';
import { OptionGroupPanel } from './OptionGroupPanel';
import { OptionGroupFormModal } from './OptionGroupFormModal';
import type { OptionGroup } from '../types';

interface OptionGroupListProps {
  productId: string;
  groups: OptionGroup[];
}

export function OptionGroupList({ productId, groups }: OptionGroupListProps) {
  const { t } = useTranslation('catalog');
  const can = useCan();
  const canCreate = can({ [RESOURCES.PRODUCT]: [ACTIONS.CREATE] });
  const { reorderOptionGroups } = useOptionGroupMutations();
  const [editing, setEditing] = useState<OptionGroup | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);

  const ids = groups.map((g) => g.id);

  return (
    <div>
      <Typography.Text type="secondary" className="text-sm">
        {t('detail.tabs.detailsDescription')}
      </Typography.Text>

      {canCreate && (
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="border-line mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-2.5 text-gray-400"
        >
          <Plus size={16} />
          <span className="text-base">{t('optionGroup.add')}</span>
        </button>
      )}

      <SortableList ids={ids} onReorder={reorderOptionGroups}>
        <div className="mt-6 flex flex-col">
          {groups.map((group, index) => (
            <Fragment key={group.id}>
              {index > 0 && <Divider className="my-4" />}
              <OptionGroupPanel group={group} onEdit={setEditing} />
            </Fragment>
          ))}
        </div>
      </SortableList>

      <OptionGroupFormModal
        productId={productId}
        group={editing}
        open={!!editing || isCreateOpen}
        onClose={() => {
          setEditing(null);
          setCreateOpen(false);
        }}
      />
    </div>
  );
}
