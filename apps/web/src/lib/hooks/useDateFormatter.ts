'use client';
import { useMemo } from 'react';
import {
  formatDate,
  formatDateLong,
  formatDateTime,
  formatDayOfMonth,
  formatMonthShort,
  formatMonthYear,
  formatRelative,
  formatTime,
  type DateInput,
} from '@/lib/date';
import { useLocaleStore } from '@/lib/stores/locale.store';
import type { Locale as AppLocale } from '@/lib/i18n/config';

export function useDateFormatter() {
  const locale = useLocaleStore((s) => s.locale) as AppLocale;

  return useMemo(
    () => ({
      /** "9 jul 2026" */
      date: (value: DateInput) => formatDate(value, locale),
      /** "9 de julio de 2026" */
      dateLong: (value: DateInput) => formatDateLong(value, locale),
      /** "9 jul 2026, 14:30" */
      dateTime: (value: DateInput) => formatDateTime(value, locale),
      /** "hace 3 días" */
      relative: (value: DateInput) => formatRelative(value, locale),
      /** "12:30 pm" */
      time: (value: string) => formatTime(value),
      /** "12" */
      dayOfMonth: (value: DateInput) => formatDayOfMonth(value, locale),
      /** "Jan" */
      monthShort: (value: DateInput) => formatMonthShort(value, locale),
      /** "January 2026" */
      monthYear: (value: DateInput) => formatMonthYear(value, locale),
    }),
    [locale],
  );
}
