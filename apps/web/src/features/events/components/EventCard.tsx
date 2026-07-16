'use client';
import { Card, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { EVENT_STATUS_COLORS } from '../helpers';
import { useEventRowActions } from '../hooks/useEventRowActions';
import type { Event } from '../types';

interface EventCardProps {
  row: Event;
  onClick: () => void;
  onAssignStaff: (event: Event) => void;
}

export function EventCard({ row, onClick, onAssignStaff }: EventCardProps) {
  const { t } = useTranslation('events');
  const { t: tc } = useTranslation('common');
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();
  const rowActions = useEventRowActions({ onAssignStaff });

  return (
    <Card size="small" onClick={onClick} className="cursor-pointer">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{row.clientName}</span>
        <div className="flex items-center gap-1">
          <Tag color={EVENT_STATUS_COLORS[row.status]}>{t(`status.${row.status}`)}</Tag>
          <div onClick={(e) => e.stopPropagation()}>
            <DataTableRowActions actions={rowActions(row)} label={tc('table.actions')} />
          </div>
        </div>
      </div>
      {row.eventTypeName && <div className="mt-1 text-sm text-gray-500">{row.eventTypeName}</div>}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">{row.eventDate ? date(row.eventDate) : '—'}</span>
        <span className="font-medium">{money(row.totalAmount)}</span>
      </div>
    </Card>
  );
}
