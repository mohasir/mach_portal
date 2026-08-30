'use client';
import { Badge } from 'antd';
import { useTranslation } from 'react-i18next';
import type { EventCalendarItem } from '../../types';
import { DEFAULT_EVENT_ACCENT_COLOR, EventDayCard } from './EventDayCard';

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

  if (compact) {
    const colors = [
      ...new Set(events.map((event) => event.eventTypeColor ?? DEFAULT_EVENT_ACCENT_COLOR)),
    ].slice(0, 3);
    return (
      <div className="flex h-2 items-center justify-center gap-1">
        {colors.map((color) => (
          <Badge key={color} color={color} />
        ))}
      </div>
    );
  }

  if (!events.length) return null;

  const visible = events.slice(0, maxVisible);
  const hidden = events.length - visible.length;

  return (
    <div className="flex flex-col gap-1">
      {visible.map((event) => (
        <EventDayCard key={event.id} event={event} onSelect={onSelect} className="relative" />
      ))}
      {hidden > 0 && (
        <span className="text-xs text-gray-500">{t('calendar.moreEvents', { count: hidden })}</span>
      )}
    </div>
  );
}
