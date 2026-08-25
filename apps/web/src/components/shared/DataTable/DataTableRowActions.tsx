'use client';
import { App, Button, Dropdown, Typography, type MenuProps } from 'antd';
import { MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useConfirmModal, useDeleteConfirm } from '@/components/shared/ConfirmDialogs';
import { useCan } from '@/lib/auth/useCan';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { ACTION_PRESETS, isDivider, stripDividers } from './helpers';
import type { ActionPreset, RowAction, RowActionItem, RowActionKey } from './types';

interface DataTableRowActionsProps {
  actions: RowActionItem[];
  label?: string;
}

export function DataTableRowActions({ actions, label }: DataTableRowActionsProps) {
  const { modal } = App.useApp();
  const { t: tc } = useTranslation('common');
  const can = useCan();
  const isDesktop = useIsDesktop();
  const [confirmDelete, deleteContextHolder] = useDeleteConfirm();
  const [confirmAction, actionContextHolder] = useConfirmModal();

  const run = (
    action: RowAction,
    preset: ActionPreset | undefined,
    okLabel: string,
    danger?: boolean,
  ) => {
    const c = action.confirm;
    const pc = preset?.confirm;
    if (!c && !pc) return action.onClick();

    const caption = c?.caption ?? (pc?.captionKey ? tc(pc.captionKey) : undefined);
    const body = c?.content;
    const title = c?.title ?? (pc?.titleKey ? tc(pc.titleKey) : undefined);
    const content =
      body || caption ? (
        <div className="flex flex-col gap-1">
          {body ? <span>{body}</span> : null}
          {caption ? (
            <Typography.Text type="secondary" className="text-xs mt-2 font-normal">
              {caption}
            </Typography.Text>
          ) : null}
        </div>
      ) : undefined;

    if (!isDesktop) {
      const options = {
        title,
        content,
        okText: c?.okText ?? okLabel,
        cancelText: c?.cancelText ?? tc('cancel'),
        onOk: action.onClick,
      };
      return danger ? confirmDelete(options) : confirmAction({ ...options, danger });
    }

    modal.confirm({
      title,
      content,
      okText: c?.okText ?? okLabel,
      cancelText: c?.cancelText ?? tc('cancel'),
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
    const label = action.label ?? (preset ? tc(preset.labelKey) : action.key);
    return {
      key: action.key,
      label,
      icon: action.icon ?? (Icon ? <Icon size={16} /> : undefined),
      danger,
      onClick: () => run(action, preset, label, danger),
    };
  });

  return (
    <>
      <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
        <Button type="text" size="small" aria-label={label} icon={<MoreHorizontal size={16} />} />
      </Dropdown>
      {deleteContextHolder}
      {actionContextHolder}
    </>
  );
}
