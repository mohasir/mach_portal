import dayjs, { type Dayjs } from 'dayjs';
import type { Meridiem, TimeDisabledConfig } from './types';

export const formatTwoDigits = (n: number) => String(n).padStart(2, '0');

export const range = (from: number, to: number, step = 1) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

export const to12h = (hour24: number) => ({
  hour: hour24 % 12 === 0 ? 12 : hour24 % 12,
  meridiem: (hour24 < 12 ? 'am' : 'pm') as Meridiem,
});

export const to24h = (hour12: number, meridiem: Meridiem) =>
  (hour12 % 12) + (meridiem === 'pm' ? 12 : 0);

/** Snaps to the minute grid so the wheel always has a row for the current value. */
export function toWheelValue(value: Dayjs | null | undefined, minuteStep: number) {
  const base = value ?? dayjs();
  const minute = Math.floor(base.minute() / minuteStep) * minuteStep;
  return base.minute(minute).second(0).millisecond(0);
}

export function isTimeDisabled(time: Dayjs, config: TimeDisabledConfig) {
  if (config.disabledHours?.().includes(time.hour())) return true;
  return !!config.disabledMinutes?.(time.hour()).includes(time.minute());
}
