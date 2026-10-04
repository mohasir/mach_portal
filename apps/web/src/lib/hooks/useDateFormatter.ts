'use client';
import { useMemo } from 'react';
import {
  formatDate,
  formatDateLong,
  formatDateTime,
  formatDayOfMonth,
  formatHour,
  formatMonthShort,
  formatMonthYear,
  formatRelative,
  formatTime,
  TIME_DISPLAY_FORMAT,
  type DateInput,
} from '@/lib/date';
import { useLocaleStore } from '@/lib/stores/locale.store';
import { useTimeFormatStore } from '@/lib/stores/timeFormat.store';

export function useDateFormatter() {
  const locale = useLocaleStore((s) => s.locale);
  const timeFormat = useTimeFormatStore((s) => s.timeFormat);

  return useMemo(
    () => ({
      /** "9 jul 2026" */
      date: (value: DateInput) => formatDate(value, locale),
      /** "9 de julio de 2026" */
      dateLong: (value: DateInput) => formatDateLong(value, locale),
      /** "9 jul 2026, 2:30 pm" / "9 jul 2026, 14:30" */
      dateTime: (value: DateInput) => formatDateTime(value, locale, timeFormat),
      /** "hace 3 días" */
      relative: (value: DateInput) => formatRelative(value, locale),
      /** "2:30 pm" / "14:30" */
      time: (value: string) => formatTime(value, timeFormat),
      /** "2 pm" / "14:00" */
      hour: (hour: number) => formatHour(hour, timeFormat),
      /** dayjs format string for time inputs (TimePicker `format`). */
      timeInputFormat: TIME_DISPLAY_FORMAT[timeFormat],
      is12h: timeFormat === '12h',
      /** "12" */
      dayOfMonth: (value: DateInput) => formatDayOfMonth(value, locale),
      /** "Jan" */
      monthShort: (value: DateInput) => formatMonthShort(value, locale),
      /** "January 2026" */
      monthYear: (value: DateInput) => formatMonthYear(value, locale),
    }),
    [locale, timeFormat],
  );
}
