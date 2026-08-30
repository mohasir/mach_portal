'use client';
import type { TableColumnsType } from 'antd';
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
      title: t('columns.color'),
      dataIndex: 'color',
      key: 'color',
      width: 64,
      render: (color: string) => (
        <span
          className="inline-block size-4 rounded-full border border-black/10"
          style={{ backgroundColor: color }}
        />
      ),
    },
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
