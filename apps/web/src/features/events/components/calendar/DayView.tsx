'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import type { Locale } from '@/lib/i18n/config';
import { CalendarDayEvents } from './CalendarDayEvents';
import { EventDayCard } from './EventDayCard';
import type { EventCalendarItem } from '../../types';

interface DayViewProps {
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

const parseHour = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) + (m ?? 0) / 60;
};

function HourLabels() {
  return (
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
  );
}

function HourGridLines() {
  return (
    <>
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="border-line absolute inset-x-0 border-t"
          style={{ top: hour * HOUR_HEIGHT }}
        />
      ))}
    </>
  );
}

function NowLine() {
  const now = dayjs();
  const top = (now.hour() + now.minute() / 60) * HOUR_HEIGHT;
  return (
    <div className="border-error absolute inset-x-0 z-10 border-t-2" style={{ top }}>
      <span className="bg-error absolute top-0 -left-1 size-2 -translate-y-1/2 rounded-full" />
    </div>
  );
}

/** Single-day agenda: a week-day strip up top, an hour timeline for the selected day below. */
export function DayView({
  weekStart,
  eventsByDay,
  locale,
  onSelectEvent,
  onSelectDate,
}: DayViewProps) {
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

  const [selectedDay, setSelectedDay] = useState<Dayjs>(
    () => days.find((d) => d.isSame(today, 'day')) ?? days[0]!,
  );

  useEffect(() => {
    setSelectedDay(days.find((d) => d.isSame(today, 'day')) ?? days[0]!);
    // Only reset the selected day when the visible week actually changes.
  }, [weekStart]);

  const selectedBucket = dayBuckets.find((b) => b.day.isSame(selectedDay, 'day')) ?? dayBuckets[0]!;

  useEffect(() => {
    if (!scrollRef.current) return;
    const earliestHour = selectedBucket.timed
      .map((e) => parseHour(e.eventTime!))
      .reduce((min, h) => Math.min(min, h), Infinity);
    const targetHour = Number.isFinite(earliestHour)
      ? Math.max(0, Math.floor(earliestHour) - 1)
      : DEFAULT_SCROLL_HOUR;
    scrollRef.current.scrollTop = targetHour * HOUR_HEIGHT;
    // Re-scroll only when the selected day changes, not on every data refresh.
  }, [selectedDay]);

  const canCreateSelected = !!onSelectDate && !selectedDay.isBefore(today, 'day');

  return (
    <div>
      <div className="border-line flex border-b pb-2">
        {days.map((day) => {
          const key = day.format('YYYY-MM-DD');
          const isSelected = day.isSame(selectedDay, 'day');
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDay(day)}
              className="flex flex-1 flex-col items-center gap-1 py-1"
            >
              <span className="text-xs text-gray-500 uppercase">{day.format('ddd')}</span>
              <span
                className={
                  isSelected
                    ? 'bg-primary flex size-7 items-center justify-center rounded-full text-sm font-medium text-ivory'
                    : 'flex size-7 items-center justify-center text-sm font-medium'
                }
              >
                {day.format('D')}
              </span>
            </button>
          );
        })}
      </div>

      {selectedBucket.allDay.length > 0 && (
        <div className="border-line border-b p-2">
          <CalendarDayEvents
            events={selectedBucket.allDay}
            compact={false}
            maxVisible={3}
            onSelect={onSelectEvent}
          />
        </div>
      )}

      <div ref={scrollRef} className="max-h-140 overflow-y-auto">
        <div
          className="relative flex"
          style={{ height: HOURS.length * HOUR_HEIGHT }}
          onClick={canCreateSelected ? () => onSelectDate(selectedDay) : undefined}
        >
          <HourLabels />
          <div className="border-line relative flex-1 border-l">
            <HourGridLines />
            {selectedDay.isSame(today, 'day') && <NowLine />}
            {selectedBucket.timed.map((event) => (
              <EventDayCard
                key={event.id}
                event={event}
                onSelect={onSelectEvent}
                className="absolute inset-x-1"
                style={{
                  top: parseHour(event.eventTime!) * HOUR_HEIGHT,
                  height: DEFAULT_DURATION_HOURS * HOUR_HEIGHT - 2,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
