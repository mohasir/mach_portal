'use client';
import { Card } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useEventRowActions } from '../hooks/useEventRowActions';
import type { Event } from '../types';

interface EventCardProps {
  row: Event;
  index: number;
  onClick: () => void;
  onAssignStaff: (event: Event) => void;
}

// Decorative, fixed rotation by position — not tied to event status (that stays a Tag on the
// desktop table); this badge is just the day-of-month/weekday chip from the reference design.
const DATE_BADGE_CLASSES = ['bg-olive-faint text-brown', 'bg-mustard text-brown'];

export function EventCard({ row, index, onClick, onAssignStaff }: EventCardProps) {
  const { t: tc } = useTranslation('common');
  const { dayOfMonth, monthShort, time } = useDateFormatter();
  const rowActions = useEventRowActions({ onAssignStaff });
  const badgeClass = DATE_BADGE_CLASSES[index % DATE_BADGE_CLASSES.length];

  return (
    <Card size="small" onClick={onClick} className="cursor-pointer">
      <div className="flex items-center gap-3">
        <div
          className={`flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl ${badgeClass}`}
        >
          {row.eventDate ? (
            <>
              <span className="text-lg leading-none font-bold">{dayOfMonth(row.eventDate)}</span>
              <span className="text-xs">{monthShort(row.eventDate)}</span>
            </>
          ) : (
            <span className="text-xs">—</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{row.clientName}</div>
          {row.eventTypeName && (
            <div className="mt-0.5 truncate text-xs text-gray-500">{row.eventTypeName}</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {row.eventTime && (
            <span className="bg-olive-faint text-primary rounded-full px-2.5 py-1 text-xs font-medium">
              {time(row.eventTime)}
            </span>
          )}
          <div onClick={(e) => e.stopPropagation()}>
            <DataTableRowActions actions={rowActions(row)} label={tc('table.actions')} />
          </div>
        </div>
      </div>
    </Card>
  );
}
