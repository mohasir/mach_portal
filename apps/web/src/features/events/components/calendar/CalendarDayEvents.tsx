'use client';
import { Badge } from 'antd';
import { useTranslation } from 'react-i18next';
import { EVENT_STATUS_COLORS } from '../../helpers';
import type { EventCalendarItem } from '../../types';

interface CalendarDayEventsProps {
  events: EventCalendarItem[];
  compact: boolean;
  maxVisible?: number;
  onSelect: (id: string) => void;
}

export function CalendarDayEvents({
  events,
  compact,
  maxVisible = 3,
  onSelect,
}: CalendarDayEventsProps) {
  const { t } = useTranslation('events');

  if (!events.length) return null;

  if (compact) {
    return (
      <div className="flex justify-center">
        <Badge count={events.length} size="small" color={EVENT_STATUS_COLORS.upcoming} />
      </div>
    );
  }

  const visible = events.slice(0, maxVisible);
  const hidden = events.length - visible.length;

  return (
    <ul className="m-0 list-none space-y-0.5 p-0">
      {visible.map((event) => (
        <li key={event.id}>
          <Badge
            color={EVENT_STATUS_COLORS[event.status]}
            text={
              <span
                className="cursor-pointer truncate text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(event.id);
                }}
              >
                {event.clientName}
              </span>
            }
          />
        </li>
      ))}
      {hidden > 0 && (
        <li className="text-xs text-gray-500">{t('calendar.moreEvents', { count: hidden })}</li>
      )}
    </ul>
  );
}
