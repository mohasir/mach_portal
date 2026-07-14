'use client';
import { useState } from 'react';
import { Tag } from 'antd';
import { ChevronDown, ChevronRight, Power, PowerOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { DataTableRowActions, type RowActionItem } from '@/components/shared/DataTable';
import { useOptionGroupMutations } from '../hooks/useOptionGroupMutations';
import { useSortableRow } from '../hooks/useSortableRow';
import { useCatalogSortable } from '../hooks/useCatalogSortable';
import { ReorderControl } from './ReorderControl';
import { OptionList } from './OptionList';
import type { OptionGroup } from '../types';

interface OptionGroupPanelProps {
  group: OptionGroup;
  onEdit: (group: OptionGroup) => void;
}

export function OptionGroupPanel({ group, onEdit }: OptionGroupPanelProps) {
  const { t } = useTranslation('catalog');
  const { t: tc } = useTranslation('common');
  const { toggleOptionGroupActive } = useOptionGroupMutations();
  const sortable = useCatalogSortable();
  const { setNodeRef, style, isDragging, dragHandleProps } = useSortableRow(group.id, sortable);
  const [expanded, setExpanded] = useState(true);

  const typeLabel =
    group.selectionType === 'included'
      ? t('optionGroup.includedShort')
      : group.maxSelect != null
        ? t('optionGroup.maxSelectShort', { count: group.maxSelect })
        : t('optionGroup.noLimitShort');

  const actions: RowActionItem[] = [
    { key: 'edit', guard: { [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] }, onClick: () => onEdit(group) },
    {
      key: 'toggleActive',
      label: t(group.isActive ? 'actions.deactivate' : 'actions.activate'),
      icon: group.isActive ? <PowerOff size={16} /> : <Power size={16} />,
      guard: { [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] },
      onClick: () => toggleOptionGroupActive(group.id, !group.isActive),
    },
  ];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border-line border-t py-2 ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <ReorderControl dragHandleProps={dragHandleProps} />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className={`truncate text-sm font-medium ${group.isActive ? '' : 'text-muted'}`}>
            {group.label}
          </span>
          <span className="text-muted text-xs whitespace-nowrap">({typeLabel})</span>
        </button>
        {!group.isActive && <Tag>{t('status.inactive')}</Tag>}
        <DataTableRowActions actions={actions} label={tc('table.actions')} />
      </div>

      {expanded && <OptionList optionGroupId={group.id} options={group.options} />}
    </div>
  );
}
