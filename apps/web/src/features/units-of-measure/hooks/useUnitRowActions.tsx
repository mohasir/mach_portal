'use client';
import { App } from 'antd';
import { Ban, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { RowActionItem } from '@/components/shared/DataTable';
import type { UnitOfMeasure } from '../types';

interface UseUnitRowActionsParams {
  onEdit: (unit: UnitOfMeasure) => void;
  onToggleActive: (unit: UnitOfMeasure) => void;
}

export function useUnitRowActions({ onEdit, onToggleActive }: UseUnitRowActionsParams) {
  const { t } = useTranslation('unitsOfMeasure');
  const { t: tc } = useTranslation('common');
  const { message } = App.useApp();

  return (unit: UnitOfMeasure): RowActionItem[] => [
    {
      key: 'copyId',
      onClick: () => {
        void navigator.clipboard.writeText(unit.id);
        message.success(tc('table.copied'));
      },
    },
    { type: 'divider' },
    {
      key: 'edit',
      guard: { [RESOURCES.UNIT_OF_MEASURE]: [ACTIONS.UPDATE] },
      onClick: () => onEdit(unit),
    },
    unit.isActive
      ? {
          key: 'deactivate',
          label: t('actions.deactivate'),
          icon: <Ban size={16} />,
          danger: true,
          guard: { [RESOURCES.UNIT_OF_MEASURE]: [ACTIONS.DISABLE] },
          onClick: () => onToggleActive(unit),
          confirm: {
            title: t('deactivateConfirm.title', { name: unit.name }),
            content: t('deactivateConfirm.content'),
            caption: t('deactivateConfirm.caption'),
            okText: t('actions.deactivate'),
          },
        }
      : {
          key: 'activate',
          label: t('actions.activate'),
          icon: <RotateCcw size={16} />,
          guard: { [RESOURCES.UNIT_OF_MEASURE]: [ACTIONS.ENABLE] },
          onClick: () => onToggleActive(unit),
        },
  ];
}
