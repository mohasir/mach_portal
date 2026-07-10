'use client';
import { App, Button, Dropdown, type MenuProps } from 'antd';
import { MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCan } from '@/lib/auth/useCan';
import { ACTION_PRESETS, type ActionPreset } from './helpers';
import type { RowAction, RowActionItem, RowActionKey } from './types';

interface DataTableRowActionsProps {
  actions: RowActionItem[];
  label?: string;
}

const isDivider = (item: RowActionItem): item is { type: 'divider' } => 'type' in item;

/** Drops leading, trailing and consecutive dividers left behind after guard filtering. */
function stripDividers(items: RowActionItem[]): RowActionItem[] {
  const out: RowActionItem[] = [];
  for (const item of items) {
    if (isDivider(item)) {
      const prev = out[out.length - 1];
      if (prev && !isDivider(prev)) out.push(item);
    } else {
      out.push(item);
    }
  }
  while (out.length && isDivider(out[out.length - 1]!)) out.pop();
  return out;
}

export function DataTableRowActions({ actions, label }: DataTableRowActionsProps) {
  const { modal } = App.useApp();
  const { t: tc } = useTranslation('common');
  const can = useCan();

  const run = (action: RowAction, danger?: boolean) => {
    if (!action.confirm) return action.onClick();
    modal.confirm({
      title: action.confirm.title,
      content: action.confirm.content,
      okText: action.confirm.okText,
      cancelText: action.confirm.cancelText,
      okButtonProps: danger ? { danger: true } : undefined,
      onOk: action.onClick,
    });
  };

  const visible = stripDividers(actions.filter((a) => isDivider(a) || !a.guard || can(a.guard)));
  if (visible.length === 0) return null;

  const items: MenuProps['items'] = visible.map((action, i) => {
    if (isDivider(action)) return { type: 'divider', key: `divider-${i}` };
    const preset = ACTION_PRESETS[action.key as RowActionKey] as ActionPreset | undefined;
    const Icon = preset?.Icon;
    const danger = action.danger ?? preset?.danger;
    return {
      key: action.key,
      label: action.label ?? (preset ? tc(preset.labelKey) : action.key),
      icon: action.icon ?? (Icon ? <Icon size={16} /> : undefined),
      danger,
      onClick: () => run(action, danger),
    };
  });

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
      <Button type="text" size="small" aria-label={label} icon={<MoreHorizontal size={16} />} />
    </Dropdown>
  );
}
