import { describe, expect, it } from 'vitest';
import { addDays, subtractDays } from './date';

describe('date utils', () => {
  it('subtractDays crosses a month boundary', () => {
    expect(subtractDays('2026-03-01', 1)).toBe('2026-02-28');
  });

  it('addDays crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
