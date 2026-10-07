'use client';
import { App } from 'antd';
import { TbRestore, TbTrashFilled } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { RowActionItem } from '@/components/shared/DataTable';
import type { RescheduleReason } from '../types';

interface UseRescheduleReasonRowActionsParams {
  onEdit: (reason: RescheduleReason) => void;
  onToggleActive: (reason: RescheduleReason) => void;
}

export function useRescheduleReasonRowActions({
  onEdit,
  onToggleActive,
}: UseRescheduleReasonRowActionsParams) {
  const { t } = useTranslation('rescheduleReasons');
  const { t: tc } = useTranslation('common');
  const { message } = App.useApp();

  return (reason: RescheduleReason): RowActionItem[] => [
    {
      key: 'copyId',
      onClick: () => {
        void navigator.clipboard.writeText(reason.id);
        message.success(tc('table.copied'));
      },
    },
    { type: 'divider' },
    {
      key: 'edit',
      guard: { [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.UPDATE] },
      onClick: () => onEdit(reason),
    },
    {
      key: 'toggleActive',
      label: reason.isActive ? t('actions.deactivate') : t('actions.activate'),
      icon: reason.isActive ? <TbTrashFilled size={16} /> : <TbRestore size={16} />,
      danger: reason.isActive,
      guard: { [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.UPDATE] },
      onClick: () => onToggleActive(reason),
      confirm: reason.isActive
        ? {
            title: t('deactivateConfirm.title', { name: reason.name }),
            content: t('deactivateConfirm.content'),
            caption: t('deactivateConfirm.caption'),
            okText: t('actions.deactivate'),
          }
        : undefined,
    },
  ];
}
