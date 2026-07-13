'use client';
import { Tag, type TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useEventTypeRowActions } from '../hooks/useEventTypeRowActions';
import type { EventType } from '../types';

interface UseEventTypesColumnsParams {
  onEdit: (eventType: EventType) => void;
}

export function useEventTypesColumns({
  onEdit,
}: UseEventTypesColumnsParams): TableColumnsType<EventType> {
  const { t } = useTranslation('eventTypes');
  const { t: tc } = useTranslation('common');
  const rowActions = useEventTypeRowActions({ onEdit });

  return [
    {
      title: t('columns.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'right',
      render: (_, eventType) => (
        <DataTableRowActions actions={rowActions(eventType)} label={tc('table.actions')} />
      ),
    },
  ];
}
