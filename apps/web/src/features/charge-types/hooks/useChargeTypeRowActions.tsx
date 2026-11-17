'use client';
import { App } from 'antd';
import { Ban, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { RowActionItem } from '@/components/shared/DataTable';
import type { ChargeType } from '../types';

interface UseChargeTypeRowActionsParams {
  onEdit: (type: ChargeType) => void;
  onToggleActive: (type: ChargeType) => void;
}

export function useChargeTypeRowActions({ onEdit, onToggleActive }: UseChargeTypeRowActionsParams) {
  const { t } = useTranslation('chargeTypes');
  const { t: tc } = useTranslation('common');
  const { message } = App.useApp();

  return (type: ChargeType): RowActionItem[] => [
    {
      key: 'copyId',
      onClick: () => {
        void navigator.clipboard.writeText(type.id);
        message.success(tc('table.copied'));
      },
    },
    { type: 'divider' },
    {
      key: 'edit',
      guard: { [RESOURCES.CHARGE_TYPE]: [ACTIONS.UPDATE] },
      onClick: () => onEdit(type),
    },
    type.isActive
      ? {
          key: 'deactivate',
          label: t('actions.deactivate'),
          icon: <Ban size={16} />,
          danger: true,
          guard: { [RESOURCES.CHARGE_TYPE]: [ACTIONS.DISABLE] },
          onClick: () => onToggleActive(type),
          confirm: {
            title: t('deactivateConfirm.title', { name: type.name }),
            content: t('deactivateConfirm.content'),
            caption: t('deactivateConfirm.caption'),
            okText: t('actions.deactivate'),
          },
        }
      : {
          key: 'activate',
          label: t('actions.activate'),
          icon: <RotateCcw size={16} />,
          guard: { [RESOURCES.CHARGE_TYPE]: [ACTIONS.ENABLE] },
          onClick: () => onToggleActive(type),
        },
  ];
}
