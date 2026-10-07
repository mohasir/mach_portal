import { describe, expect, it } from 'vitest';
import { isSameSchedule } from './helpers';

describe('isSameSchedule', () => {
  const current = { eventDate: '2026-10-17', eventTime: '17:30' };

  it('is true when date and time match the current ones', () => {
    expect(isSameSchedule(current, { eventDate: '2026-10-17', eventTime: '17:30' })).toBe(true);
  });

  it('is false when only the date changes', () => {
    expect(isSameSchedule(current, { eventDate: '2026-11-20', eventTime: '17:30' })).toBe(false);
  });

  it('is false when only the time changes', () => {
    expect(isSameSchedule(current, { eventDate: '2026-10-17', eventTime: '19:00' })).toBe(false);
  });

  it('is false when the time is cleared', () => {
    expect(isSameSchedule(current, { eventDate: '2026-10-17' })).toBe(false);
  });

  it('treats a missing time on both sides as the same', () => {
    expect(
      isSameSchedule({ eventDate: '2026-10-17', eventTime: null }, { eventDate: '2026-10-17' }),
    ).toBe(true);
  });

  it('is false when the event had no date yet', () => {
    expect(isSameSchedule({ eventDate: null, eventTime: null }, { eventDate: '2026-10-17' })).toBe(
      false,
    );
  });

  it('is false while no new date is picked', () => {
    expect(isSameSchedule(current, { eventDate: undefined, eventTime: '17:30' })).toBe(false);
  });
});
