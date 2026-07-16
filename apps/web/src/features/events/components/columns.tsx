'use client';
import { Tag, type TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { EVENT_STATUS_COLORS } from '../helpers';
import { useEventRowActions } from '../hooks/useEventRowActions';
import type { Event } from '../types';

interface UseEventsColumnsParams {
  onAssignStaff: (event: Event) => void;
}

export function useEventsColumns({
  onAssignStaff,
}: UseEventsColumnsParams): TableColumnsType<Event> {
  const { t } = useTranslation('events');
  const { t: tc } = useTranslation('common');
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();
  const rowActions = useEventRowActions({ onAssignStaff });

  return [
    { title: t('columns.client'), dataIndex: 'clientName', key: 'clientName' },
    {
      title: t('columns.eventType'),
      dataIndex: 'eventTypeName',
      key: 'eventTypeName',
      responsive: ['md'],
      render: (value: Event['eventTypeName']) => value ?? '—',
    },
    {
      title: t('columns.eventDate'),
      dataIndex: 'eventDate',
      key: 'eventDate',
      render: (value: Event['eventDate']) => (value ? date(value) : '—'),
    },
    {
      title: t('columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: Event['status']) => (
        <Tag color={EVENT_STATUS_COLORS[status]}>{t(`status.${status}`)}</Tag>
      ),
    },
    {
      title: t('columns.total'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      render: (value: Event['totalAmount']) => money(value),
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'right',
      render: (_, event) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DataTableRowActions actions={rowActions(event)} label={tc('table.actions')} />
        </div>
      ),
    },
  ];
}
