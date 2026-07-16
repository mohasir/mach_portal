'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Calendar, Grid } from 'antd';
import type { CalendarProps } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useEventsCalendar } from '../../hooks/useEvents';
import { EVENT_STATUS_COLORS } from '../../helpers';
import type { EventCalendarItem } from '../../types';

const MAX_VISIBLE = 3;

export function EventsCalendar() {
  const { t } = useTranslation('events');
  const router = useRouter();
  const screens = Grid.useBreakpoint();
  const [cursor, setCursor] = useState<Dayjs>(() => dayjs());

  const { data } = useEventsCalendar({ month: cursor.month() + 1, year: cursor.year() });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventCalendarItem[]>();
    for (const event of data ?? []) {
      if (!event.eventDate) continue;
      const list = map.get(event.eventDate) ?? [];
      list.push(event);
      map.set(event.eventDate, list);
    }
    return map;
  }, [data]);

  const goToEvent = (id: string) => router.push(`/admin/events/${id}`);

  const cellRender: NonNullable<CalendarProps<Dayjs>['cellRender']> = (current, info) => {
    if (info.type !== 'date') return info.originNode;

    const dayEvents = eventsByDay.get(current.format('YYYY-MM-DD')) ?? [];
    if (!dayEvents.length) return null;

    if (!screens.md) {
      return (
        <div className="flex justify-center">
          <Badge count={dayEvents.length} size="small" color={EVENT_STATUS_COLORS.upcoming} />
        </div>
      );
    }

    const visible = dayEvents.slice(0, MAX_VISIBLE);
    const hidden = dayEvents.length - visible.length;

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
                    goToEvent(event.id);
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
  };

  return (
    <Calendar
      value={cursor}
      fullscreen={!!screens.md}
      cellRender={cellRender}
      onPanelChange={setCursor}
    />
  );
}
