import dayjs from 'dayjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disabledPastDate, disabledPastTime } from './index';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('picker restrictions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 10, 14, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('disables days before today only', () => {
    expect(disabledPastDate(dayjs('2026-10-09'))).toBe(true);
    expect(disabledPastDate(dayjs('2026-10-10'))).toBe(false);
    expect(disabledPastDate(dayjs('2026-10-11'))).toBe(false);
  });

  it('disables no time when there is no date or it is not today', () => {
    expect(disabledPastTime(undefined)()).toEqual({});
    expect(disabledPastTime(null)()).toEqual({});
    expect(disabledPastTime(dayjs('2026-10-11'))()).toEqual({});
  });

  it('disables past hours and minutes when the date is today', () => {
    const rules = disabledPastTime(dayjs('2026-10-10'))();
    expect(rules.disabledHours?.()).toEqual(range(14));
    expect(rules.disabledMinutes?.(14)).toEqual(range(30));
    expect(rules.disabledMinutes?.(15)).toEqual([]);
  });
});
