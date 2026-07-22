'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Grid } from 'antd';
import type { CalendarProps } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { Locale as AppLocale } from '@/lib/i18n/config';
import { useCan } from '@/lib/auth/useCan';
import { isPastDate } from '@/lib/date';
import { useLocaleStore } from '@/lib/stores/locale.store';
import { useEventsCalendar } from '../../hooks/useEvents';
import type { EventCalendarItem } from '../../types';
import { CalendarDayEvents } from './CalendarDayEvents';
import { CalendarToolbar } from './CalendarToolbar';
import { WeekView } from './WeekView';
import { YearView } from './YearView';
import type { CalendarViewMode } from './types';

const UNIT_BY_VIEW: Record<CalendarViewMode, 'month' | 'week' | 'year'> = {
  month: 'month',
  week: 'week',
  year: 'year',
};

export function EventsCalendar() {
  const router = useRouter();
  const can = useCan();
  const canCreateQuote = can({ [RESOURCES.QUOTE]: [ACTIONS.CREATE] });
  const locale = useLocaleStore((s) => s.locale) as AppLocale;
  const screens = Grid.useBreakpoint();
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [cursor, setCursor] = useState<Dayjs>(() => dayjs());
  const [search, setSearch] = useState('');

  const rangeStart = viewMode === 'week' ? cursor.startOf('week') : cursor.startOf('month');
  const rangeEnd = viewMode === 'week' ? rangeStart.add(6, 'day') : cursor.endOf('month');

  // Year view is a pure date grid (no event dots, matches the reference), so skip the fetch.
  const calendarEnabled = viewMode !== 'year';
  const queryA = useEventsCalendar(
    { month: rangeStart.month() + 1, year: rangeStart.year() },
    { enabled: calendarEnabled },
  );
  const queryB = useEventsCalendar(
    { month: rangeEnd.month() + 1, year: rangeEnd.year() },
    { enabled: calendarEnabled },
  );

  const events = useMemo(() => {
    const map = new Map<string, EventCalendarItem>();
    for (const event of queryA.data ?? []) map.set(event.id, event);
    for (const event of queryB.data ?? []) map.set(event.id, event);
    return Array.from(map.values());
  }, [queryA.data, queryB.data]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return events;
    return events.filter(
      (event) =>
        event.clientName.toLowerCase().includes(term) ||
        (event.eventTypeName?.toLowerCase().includes(term) ?? false),
    );
  }, [events, search]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventCalendarItem[]>();
    for (const event of filteredEvents) {
      if (!event.eventDate) continue;
      const list = map.get(event.eventDate) ?? [];
      list.push(event);
      map.set(event.eventDate, list);
    }
    return map;
  }, [filteredEvents]);

  const periodLabel = useMemo(() => {
    if (viewMode === 'year') return cursor.locale(locale).format('YYYY');
    if (viewMode === 'month') return cursor.locale(locale).format('MMMM YYYY');

    const start = rangeStart.locale(locale);
    const end = rangeEnd.locale(locale);
    if (start.isSame(end, 'month')) return `${start.format('MMM D')} - ${end.format('D, YYYY')}`;
    if (start.isSame(end, 'year')) return `${start.format('MMM D')} - ${end.format('MMM D, YYYY')}`;
    return `${start.format('MMM D, YYYY')} - ${end.format('MMM D, YYYY')}`;
  }, [viewMode, cursor, rangeStart, rangeEnd, locale]);

  const goToEvent = (id: string) => router.push(`/admin/events/${id}`);
  const goToNewQuote = (date: Dayjs) => {
    if (isPastDate(date.format('YYYY-MM-DD'))) return;
    router.push(`/admin/quotes/new?eventDate=${date.format('YYYY-MM-DD')}`);
  };
  const onToday = () => setCursor(dayjs());
  const onNavigate = (direction: 'prev' | 'next') => {
    setCursor((c) => c.add(direction === 'next' ? 1 : -1, UNIT_BY_VIEW[viewMode]));
  };
  const onSelectYearDate = (date: Dayjs) => {
    setCursor(date);
    setViewMode('month');
  };

  const cellRender: NonNullable<CalendarProps<Dayjs>['cellRender']> = (current, info) => {
    if (info.type !== 'date') return info.originNode;

    return (
      <CalendarDayEvents
        events={eventsByDay.get(current.format('YYYY-MM-DD')) ?? []}
        compact={!screens.md}
        onSelect={goToEvent}
      />
    );
  };

  return (
    <div>
      <CalendarToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        periodLabel={periodLabel}
        onNavigate={onNavigate}
        onToday={onToday}
        search={search}
        onSearchChange={setSearch}
      />
      {viewMode === 'week' && (
        <WeekView
          weekStart={rangeStart}
          eventsByDay={eventsByDay}
          locale={locale}
          onSelectEvent={goToEvent}
          onSelectDate={canCreateQuote ? goToNewQuote : undefined}
        />
      )}
      {viewMode === 'year' && (
        <YearView year={cursor.year()} locale={locale} onSelectDate={onSelectYearDate} />
      )}
      {viewMode === 'month' && (
        <Calendar
          value={cursor}
          mode="month"
          fullscreen={!!screens.md}
          cellRender={cellRender}
          onPanelChange={setCursor}
          onSelect={(date, info) => {
            if (canCreateQuote && info.source === 'date') goToNewQuote(date);
          }}
        />
      )}
    </div>
  );
}
