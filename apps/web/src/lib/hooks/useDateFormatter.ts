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
  formatTimeHourMinute,
  formatTimeMeridiem,
  TIME_DISPLAY_FORMAT,
  type DateInput,
} from '@/lib/date';
import { useUserPreferences } from '@/features/settings';
import { useLocaleStore } from '@/lib/stores/locale.store';
import type { Locale as AppLocale } from '@/lib/i18n/config';

export function useDateFormatter() {
  const locale = useLocaleStore((s) => s.locale) as AppLocale;
  // Read-only from the cache: SettingsProvider fetches it once signed in, so formatters used on
  // public pages don't fire an unauthenticated request.
  const { data: preferences } = useUserPreferences(false);
  const timeFormat = preferences?.timeFormat ?? '12h';

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
      /** "12:30" */
      timeHourMinute: (value: string) => formatTimeHourMinute(value),
      /** "pm" */
      timeMeridiem: (value: string) => formatTimeMeridiem(value),
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
