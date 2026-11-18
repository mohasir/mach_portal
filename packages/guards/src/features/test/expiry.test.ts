import { describe, expect, it } from 'vitest';
import { EXPIRING_SOON_DAYS, expiryStatus } from '../expiry';

const now = new Date('2026-01-01T00:00:00Z');
const inDays = (days: number, extraMs = 0) => new Date(now.getTime() + days * 86_400_000 + extraMs);

describe('expiryStatus', () => {
  it('is permanent without an expiry', () => {
    expect(expiryStatus(null, now)).toEqual({ state: 'permanent' });
  });

  it('is active beyond 30 days', () => {
    expect(EXPIRING_SOON_DAYS).toBe(30);
    expect(expiryStatus(inDays(30, 1), now)).toEqual({ state: 'active', daysLeft: 31 });
    expect(expiryStatus(inDays(90), now)).toEqual({ state: 'active', daysLeft: 90 });
  });

  it('is expiringSoon within 30 days with the days left', () => {
    expect(expiryStatus(inDays(30), now)).toEqual({ state: 'expiringSoon', daysLeft: 30 });
    expect(expiryStatus(inDays(5, -1), now)).toEqual({ state: 'expiringSoon', daysLeft: 5 });
    expect(expiryStatus(inDays(0, 1), now)).toEqual({ state: 'expiringSoon', daysLeft: 1 });
  });

  it('is expired at and after the expiry instant', () => {
    expect(expiryStatus(now, now)).toEqual({ state: 'expired' });
    expect(expiryStatus(inDays(-3), now)).toEqual({ state: 'expired' });
  });
});
