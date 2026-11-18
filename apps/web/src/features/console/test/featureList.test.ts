import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { formatIsoDay } from '@/lib/date';
import { activeKeySet, formatFeaturePrice } from '../helpers';

describe('activeKeySet', () => {
  it('holds the active toggleable features plus every core feature', () => {
    const keys = activeKeySet([
      { key: 'quotes', active: true },
      { key: 'events', active: false },
    ]);
    expect(keys.has('quotes')).toBe(true);
    expect(keys.has('events')).toBe(false);
    expect(keys.has('clients')).toBe(true);
  });
});

describe('formatFeaturePrice', () => {
  it('formats with the stored currency', () => {
    expect(formatFeaturePrice(1999, 'USD', 'en')).toBe('$19.99');
  });

  it('shows the bare amount without a currency', () => {
    expect(formatFeaturePrice(1999, null, 'en')).toBe('19.99');
  });
});

describe('formatIsoDay', () => {
  it('formats a calendar day as YYYY-MM-DD', () => {
    expect(formatIsoDay(dayjs('2027-03-09'))).toBe('2027-03-09');
  });
});
