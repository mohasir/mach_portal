'use client';
import type { CSSProperties } from 'react';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import type { EventCalendarItem } from '../../types';

interface EventDayCardProps {
  event: EventCalendarItem;
  onSelect: (id: string) => void;
  /** Must set the card's own `position` (`relative` for a stacked list, `absolute` for a timeline). */
  className: string;
  style?: CSSProperties;
}

export const DEFAULT_EVENT_ACCENT_COLOR = 'var(--color-link)';

export function EventDayCard({ event, onSelect, className, style }: EventDayCardProps) {
  const { time } = useDateFormatter();
  const accentColor = event.eventTypeColor ?? DEFAULT_EVENT_ACCENT_COLOR;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(event.id);
      }}
      className={`overflow-hidden rounded-md py-2 pr-2 pl-4 text-left text-xs leading-tight ${className}`}
      style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 10%, transparent)`, ...style }}
    >
      <span
        className="absolute top-1 bottom-1 left-1 w-1 rounded-full"
        style={{ backgroundColor: accentColor }}
      />
      <div>
        <span className="block truncate font-medium mb-1">{event.clientName}</span>
        <span className="block text-muted truncate mb-1">{event.eventTypeName}</span>
        {event.eventTime && (
          <span className="block text-muted truncate">{time(event.eventTime)}</span>
        )}
      </div>
    </button>
  );
}
