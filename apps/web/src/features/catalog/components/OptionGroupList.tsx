'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { reorderOptionGroups } = useOptionGroupMutations();
  const [editing, setEditing] = useState<OptionGroup | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);

  const ids = groups.map((g) => g.id);

  return (
    <div className="pl-6">
      <SortableList ids={ids} onReorder={reorderOptionGroups}>
        {groups.map((group) => (
          <OptionGroupPanel key={group.id} group={group} onEdit={setEditing} />
        ))}
      </SortableList>

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="border-line mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-2.5 text-gray-400"
      >
        <Plus size={16} />
        <span className="text-base">{t('optionGroup.add')}</span>
      </button>

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
