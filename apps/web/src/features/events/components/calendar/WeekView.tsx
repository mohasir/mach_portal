'use client';
import { useEffect, useMemo, useRef } from 'react';
import { Grid } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { Locale } from '@/lib/i18n/config';
import { CalendarDayEvents } from './CalendarDayEvents';
import type { Event, EventCalendarItem } from '../../types';

interface WeekViewProps {
  weekStart: Dayjs;
  eventsByDay: Map<string, EventCalendarItem[]>;
  locale: Locale;
  onSelectEvent: (id: string) => void;
  onSelectDate?: (day: Dayjs) => void;
}

const HOUR_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DEFAULT_DURATION_HOURS = 1;
const DEFAULT_SCROLL_HOUR = 8;

// Tailwind classes over the app's semantic tokens (theme/globals.css), never hex —
// mirrors what EVENT_STATUS_COLORS means for antd Tag/Badge, but for a plain styled block.
const STATUS_ACCENT_CLASS: Record<Event['status'], string> = {
  upcoming: 'border-primary bg-primary/10 text-primary',
  completed: 'border-success bg-success/10 text-success',
  cancelled: 'border-error bg-error/10 text-error',
};

const parseHour = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) + (m ?? 0) / 60;
};

export function WeekView({
  weekStart,
  eventsByDay,
  locale,
  onSelectEvent,
  onSelectDate,
}: WeekViewProps) {
  const screens = Grid.useBreakpoint();
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = dayjs();
  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day').locale(locale));

  const dayBuckets = useMemo(
    () =>
      days.map((day) => {
        const dayEvents = eventsByDay.get(day.format('YYYY-MM-DD')) ?? [];
        return {
          day,
          allDay: dayEvents.filter((e) => !e.eventTime),
          timed: dayEvents.filter((e) => !!e.eventTime),
        };
      }),
    // `days` is derived fresh each render from weekStart/locale
    [weekStart, locale, eventsByDay],
  );

  const hasAllDay = dayBuckets.some((b) => b.allDay.length > 0);

  useEffect(() => {
    if (!scrollRef.current) return;
    const earliestHour = dayBuckets
      .flatMap((b) => b.timed)
      .map((e) => parseHour(e.eventTime!))
      .reduce((min, h) => Math.min(min, h), Infinity);
    const targetHour = Number.isFinite(earliestHour)
      ? Math.max(0, Math.floor(earliestHour) - 1)
      : DEFAULT_SCROLL_HOUR;
    scrollRef.current.scrollTop = targetHour * HOUR_HEIGHT;
    // Re-scroll only when the visible week changes, not on every data refresh.
  }, [weekStart]);

  if (!screens.md) {
    return (
      <div className="border-line rounded border">
        {days.map((day, index) => {
          const key = day.format('YYYY-MM-DD');
          const isToday = day.isSame(today, 'day');
          const canCreate = !!onSelectDate && !day.isBefore(today, 'day');
          return (
            <div
              key={key}
              className={`flex items-start gap-3 p-3 ${index > 0 ? 'border-line border-t' : ''}`}
            >
              <div
                className={`flex w-12 shrink-0 flex-col items-center ${canCreate ? 'cursor-pointer' : ''}`}
                onClick={canCreate ? () => onSelectDate(day) : undefined}
              >
                <span className="text-xs text-gray-500 uppercase">{day.format('ddd')}</span>
                <span className={`text-lg font-medium ${isToday ? 'text-primary' : ''}`}>
                  {day.format('D')}
                </span>
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <CalendarDayEvents
                  events={eventsByDay.get(key) ?? []}
                  compact={false}
                  maxVisible={5}
                  onSelect={onSelectEvent}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="border-line overflow-hidden rounded border">
      <div className="border-line flex border-b">
        <div className="w-14 shrink-0" />
        {dayBuckets.map(({ day }) => {
          const isToday = day.isSame(today, 'day');
          const canCreate = !!onSelectDate && !day.isBefore(today, 'day');
          return (
            <div
              key={day.format('YYYY-MM-DD')}
              className={`flex flex-1 flex-col items-center py-2 ${canCreate ? 'cursor-pointer' : ''}`}
              onClick={canCreate ? () => onSelectDate(day) : undefined}
            >
              <span className="text-xs text-gray-500 uppercase">{day.format('ddd')}</span>
              <span
                className={
                  isToday
                    ? 'bg-primary flex h-7 w-7 items-center justify-center rounded-full text-base font-medium text-white'
                    : 'text-base font-medium'
                }
              >
                {day.format('D')}
              </span>
            </div>
          );
        })}
      </div>

      {hasAllDay && (
        <div className="border-line flex border-b">
          <div className="w-14 shrink-0" />
          {dayBuckets.map(({ day, allDay }) => (
            <div
              key={day.format('YYYY-MM-DD')}
              className="border-line flex-1 border-l p-1 first:border-l-0"
            >
              <CalendarDayEvents
                events={allDay}
                compact={false}
                maxVisible={3}
                onSelect={onSelectEvent}
              />
            </div>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="max-h-140 overflow-y-auto">
        <div className="flex" style={{ height: HOURS.length * HOUR_HEIGHT }}>
          <div className="relative w-14 shrink-0">
            {HOURS.map(
              (hour) =>
                hour > 0 && (
                  <div
                    key={hour}
                    className="absolute right-2 -translate-y-1/2 text-xs text-gray-400"
                    style={{ top: hour * HOUR_HEIGHT }}
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                ),
            )}
          </div>
          {dayBuckets.map(({ day, timed }) => (
            <div
              key={day.format('YYYY-MM-DD')}
              className="border-line relative flex-1 border-l first:border-l-0"
            >
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="border-line absolute inset-x-0 border-t"
                  style={{ top: hour * HOUR_HEIGHT }}
                />
              ))}
              {timed.map((event) => {
                const top = parseHour(event.eventTime!) * HOUR_HEIGHT;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onSelectEvent(event.id)}
                    className={`absolute inset-x-1 overflow-hidden rounded border px-2 py-1 text-left text-xs leading-tight ${STATUS_ACCENT_CLASS[event.status]}`}
                    style={{ top, height: DEFAULT_DURATION_HOURS * HOUR_HEIGHT - 2 }}
                  >
                    <div className="truncate font-medium">{event.clientName}</div>
                    <div className="truncate opacity-80">{event.eventTime}</div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
