'use client';
import { useState } from 'react';
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

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="border-line mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-2.5 text-gray-400"
      >
        <Plus size={16} />
        <span className="text-base">{t('option.add')}</span>
      </button>

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
