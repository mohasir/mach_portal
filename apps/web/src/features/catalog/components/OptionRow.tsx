'use client';
import { Tag } from 'antd';
import { Power, PowerOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { DataTableRowActions, type RowActionItem } from '@/components/shared/DataTable';
import { useOptionMutations } from '../hooks/useOptionMutations';
import { useSortableRow } from '../hooks/useSortableRow';
import { ReorderControl } from './ReorderControl';
import type { Option } from '../types';

interface OptionRowProps {
  option: Option;
  onEdit: (option: Option) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
}

export function OptionRow({ option, onEdit, onMoveUp, onMoveDown, disableUp, disableDown }: OptionRowProps) {
  const { t } = useTranslation('catalog');
  const { t: tc } = useTranslation('common');
  const { toggleOptionActive } = useOptionMutations();
  const { setNodeRef, style, isDragging, dragHandleProps } = useSortableRow(option.id, true);

  const actions: RowActionItem[] = [
    { key: 'edit', guard: { [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] }, onClick: () => onEdit(option) },
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
      <ReorderControl
        dragHandleProps={dragHandleProps}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        disableUp={disableUp}
        disableDown={disableDown}
      />
      <span className={`min-w-0 flex-1 truncate text-sm ${option.isActive ? '' : 'text-muted'}`}>
        {option.name}
      </span>
      {!option.isActive && <Tag>{t('status.inactive')}</Tag>}
      <DataTableRowActions actions={actions} label={tc('table.actions')} />
    </div>
  );
}
