'use client';
import { useState } from 'react';
import { Button } from 'antd';
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

      <Button
        type="dashed"
        size="small"
        icon={<Plus size={14} />}
        className="mt-2"
        onClick={() => setCreateOpen(true)}
      >
        {t('optionGroup.add')}
      </Button>

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
