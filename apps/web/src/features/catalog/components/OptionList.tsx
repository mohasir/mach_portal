'use client';
import { useState } from 'react';
import { Button } from 'antd';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOptionMutations } from '../hooks/useOptionMutations';
import { SortableList } from './SortableList';
import { OptionRow } from './OptionRow';
import { OptionFormModal } from './OptionFormModal';
import type { Option } from '../types';

interface OptionListProps {
  optionGroupId: string;
  options: Option[];
}

export function OptionList({ optionGroupId, options }: OptionListProps) {
  const { t } = useTranslation('catalog');
  const { reorderOptions } = useOptionMutations();
  const [editing, setEditing] = useState<Option | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);

  const ids = options.map((o) => o.id);

  return (
    <div className="pl-6">
      <SortableList ids={ids} onReorder={reorderOptions}>
        {options.map((option) => (
          <OptionRow key={option.id} option={option} onEdit={setEditing} />
        ))}
      </SortableList>

      <Button
        type="dashed"
        size="small"
        icon={<Plus size={14} />}
        className="mt-1"
        onClick={() => setCreateOpen(true)}
      >
        {t('option.add')}
      </Button>

      <OptionFormModal
        optionGroupId={optionGroupId}
        option={editing}
        open={!!editing || isCreateOpen}
        onClose={() => {
          setEditing(null);
          setCreateOpen(false);
        }}
      />
    </div>
  );
}
