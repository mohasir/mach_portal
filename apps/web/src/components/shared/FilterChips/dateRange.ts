import dayjs from 'dayjs';
import type { DateRange } from '@/components/shared/DateRangeCalendar';
import type { DateRangePreset, DateRangeValue } from './types';

const ISO_DATE = 'YYYY-MM-DD';

export const DATE_RANGE_PRESETS: DateRangePreset[] = ['today', 'last7Days', 'thisMonth', 'lastMonth'];

/** With `disableFuture`, ranges that would reach past today stop at today instead. */
export function presetRange(key: DateRangePreset, disableFuture: boolean): DateRange {
  const today = dayjs();
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case 'last7Days':
      return { from: today.subtract(6, 'day'), to: today };
    case 'thisMonth':
      return { from: today.startOf('month'), to: disableFuture ? today : today.endOf('month') };
    case 'lastMonth':
      return {
        from: today.subtract(1, 'month').startOf('month'),
        to: today.subtract(1, 'month').endOf('month'),
      };
  }
}

export const toIsoRange = ({ from, to }: DateRange) => ({
  from: from?.format(ISO_DATE),
  to: to?.format(ISO_DATE),
});

/**
 * The ISO dates a filter value stands for right now. Presets are kept by name and resolved here,
 * so "Today" keeps meaning today after midnight instead of freezing the day it was picked.
 */
export const resolveDateRange = (value: DateRangeValue, disableFuture = false) =>
  value.preset ? toIsoRange(presetRange(value.preset, disableFuture)) : value;
