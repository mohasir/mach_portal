'use client';
import { Tag } from 'antd';
import { Power, PowerOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { DataTableRowActions, type RowActionItem } from '@/components/shared/DataTable';
import { useOptionMutations } from '../hooks/useOptionMutations';
import { useSortableRow } from '../hooks/useSortableRow';
import { useCatalogSortable } from '../hooks/useCatalogSortable';
import { ReorderControl } from './ReorderControl';
import type { Option } from '../types';

interface OptionRowProps {
  option: Option;
  onEdit: (option: Option) => void;
}

export function OptionRow({ option, onEdit }: OptionRowProps) {
  const { t } = useTranslation('catalog');
  const { t: tc } = useTranslation('common');
  const { toggleOptionActive } = useOptionMutations();
  const sortable = useCatalogSortable();
  const { setNodeRef, style, isDragging, dragHandleProps } = useSortableRow(option.id, sortable);

  const actions: RowActionItem[] = [
    {
      key: 'edit',
      guard: { [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] },
      onClick: () => onEdit(option),
    },
    {
      key: 'toggleActive',
      label: t(option.isActive ? 'actions.deactivate' : 'actions.activate'),
      icon: option.isActive ? <PowerOff size={16} /> : <Power size={16} />,
      guard: { [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] },
      onClick: () => toggleOptionActive(option.id, !option.isActive),
    },
  ];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 py-1.5 ${isDragging ? 'opacity-50' : ''}`}
    >
      <ReorderControl dragHandleProps={dragHandleProps} />
      <div className="min-w-0 flex-1">
        <div className={`truncate text-base ${option.isActive ? '' : 'text-muted'}`}>
          {option.name}
        </div>
        {option.description && (
          <div className="text-muted truncate text-xs">{option.description}</div>
        )}
      </div>
      {!option.isActive && <Tag>{t('status.inactive')}</Tag>}
      <DataTableRowActions actions={actions} label={tc('table.actions')} />
    </div>
  );
}
