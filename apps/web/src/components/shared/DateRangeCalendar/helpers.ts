import type { Dayjs } from 'dayjs';
import type { DateRange } from './types';

/**
 * Applies a picked `day` to the end being edited. A start after the current end clears the end,
 * so the range never comes out inverted.
 */
export function pickDay(range: DateRange, day: Dayjs, editing: 'from' | 'to'): DateRange {
  if (editing === 'from') {
    return { from: day, to: range.to && day.isAfter(range.to, 'day') ? null : range.to };
  }
  return { from: range.from, to: day };
}
