import { describe, expect, it } from 'vitest';
import { FEATURE_KEYS, FEATURES } from '../registry';
import { resolveFeatures, type FeatureRow } from '../resolve';

const now = new Date('2026-01-01T00:00:00Z');
const row = (featureKey: string, over: Partial<FeatureRow> = {}): FeatureRow => ({
  featureKey,
  enabled: true,
  expiresAt: null,
  ...over,
});
const coreKeys = FEATURE_KEYS.filter((k) => FEATURES[k].kind === 'core');

describe('resolveFeatures', () => {
  it('always includes core features', () => {
    const set = resolveFeatures([], now);
    expect([...set].sort()).toEqual([...coreKeys].sort());
  });

  it('activates an enabled permanent feature', () => {
    expect(resolveFeatures([row('quotes')], now).has('quotes')).toBe(true);
  });

  it('keeps a disabled feature inactive', () => {
    expect(resolveFeatures([row('quotes', { enabled: false })], now).has('quotes')).toBe(false);
  });

  it('treats expiresAt equal to now as expired and a later one as active', () => {
    expect(resolveFeatures([row('quotes', { expiresAt: now })], now).has('quotes')).toBe(false);
    const later = new Date(now.getTime() + 1);
    expect(resolveFeatures([row('quotes', { expiresAt: later })], now).has('quotes')).toBe(true);
  });

  it('deactivates events when its required quotes is expired', () => {
    const set = resolveFeatures([row('events'), row('quotes', { expiresAt: now })], now);
    expect(set.has('events')).toBe(false);
  });

  it('deactivates events when quotes has no row', () => {
    expect(resolveFeatures([row('events')], now).has('events')).toBe(false);
  });

  it('activates events when quotes is active', () => {
    const set = resolveFeatures([row('events'), row('quotes')], now);
    expect(set.has('events')).toBe(true);
  });

  it('ignores unknown keys', () => {
    const set = resolveFeatures([row('nope')], now);
    expect(set.size).toBe(coreKeys.length);
  });
});
