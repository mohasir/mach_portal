'use client';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { RowActionItem } from '@/components/shared/DataTable';
import type { EventType } from '../types';

interface UseEventTypeRowActionsParams {
  onEdit: (eventType: EventType) => void;
}

export function useEventTypeRowActions({ onEdit }: UseEventTypeRowActionsParams) {
  const { t: tc } = useTranslation('common');
  const { message } = App.useApp();

  return (eventType: EventType): RowActionItem[] => [
    {
      key: 'copyId',
      onClick: () => {
        void navigator.clipboard.writeText(eventType.id);
        message.success(tc('table.copied'));
      },
    },
    { type: 'divider' },
    {
      key: 'edit',
      guard: { [RESOURCES.EVENT_TYPE]: [ACTIONS.UPDATE] },
      onClick: () => onEdit(eventType),
    },
  ];
}
