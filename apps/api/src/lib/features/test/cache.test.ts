import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEATURE_KEYS, FEATURES, type FeatureRow } from '@repo/guards';
import { clearFeatureCache, FEATURE_CACHE_TTL_MS, getTenantFeatures } from '../cache';

const CORE = FEATURE_KEYS.filter((k) => FEATURES[k].kind === 'core');
const T0 = new Date('2030-01-01T00:00:00Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

const row = (featureKey: string, expiresAt: Date | null = null): FeatureRow => ({
  featureKey,
  enabled: true,
  expiresAt,
});

describe('getTenantFeatures', () => {
  beforeEach(() => clearFeatureCache());
  afterEach(() => vi.restoreAllMocks());

  it('resolves the loaded rows on top of the core features', async () => {
    const features = await getTenantFeatures('t1', async () => [row('quotes')], T0);
    expect([...features].sort()).toEqual([...CORE, 'quotes'].sort());
  });

  it('does not reload within the TTL', async () => {
    const load = vi.fn(async () => [row('quotes')]);
    await getTenantFeatures('t1', load, T0);
    const again = await getTenantFeatures('t1', load, at(FEATURE_CACHE_TTL_MS - 1));
    expect(load).toHaveBeenCalledTimes(1);
    expect(again.has('quotes')).toBe(true);
  });

  it('reloads once the TTL has passed', async () => {
    const load = vi
      .fn<() => Promise<FeatureRow[]>>()
      .mockResolvedValueOnce([row('quotes')])
      .mockResolvedValueOnce([]);
    await getTenantFeatures('t1', load, T0);
    const later = await getTenantFeatures('t1', load, at(FEATURE_CACHE_TTL_MS));
    expect(load).toHaveBeenCalledTimes(2);
    expect(later.has('quotes')).toBe(false);
  });

  it('applies an expiry that falls inside the TTL without waiting for a reload', async () => {
    const load = vi.fn(async () => [row('quotes', at(1_000))]);
    expect((await getTenantFeatures('t1', load, T0)).has('quotes')).toBe(true);
    expect((await getTenantFeatures('t1', load, at(1_000))).has('quotes')).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps one entry per organization', async () => {
    const loadA = vi.fn(async () => [row('quotes')]);
    const loadB = vi.fn(async () => [row('notifications')]);
    const a = await getTenantFeatures('tenant-a', loadA, T0);
    const b = await getTenantFeatures('tenant-b', loadB, T0);
    expect(a.has('quotes')).toBe(true);
    expect(a.has('notifications')).toBe(false);
    expect(b.has('notifications')).toBe(true);
    expect(b.has('quotes')).toBe(false);
    expect(loadB).toHaveBeenCalledTimes(1);
  });

  it('fails closed to the core features and does not cache the failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const load = vi
      .fn<() => Promise<FeatureRow[]>>()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce([row('quotes')]);

    const failed = await getTenantFeatures('t1', load, T0);
    expect([...failed].sort()).toEqual([...CORE].sort());

    const retried = await getTenantFeatures('t1', load, at(1));
    expect(load).toHaveBeenCalledTimes(2);
    expect(retried.has('quotes')).toBe(true);
  });

  it('clearFeatureCache drops one organization or all of them', async () => {
    const load = vi.fn(async () => [row('quotes')]);
    await getTenantFeatures('a', load, T0);
    await getTenantFeatures('b', load, T0);

    clearFeatureCache('a');
    await getTenantFeatures('a', load, T0);
    await getTenantFeatures('b', load, T0);
    expect(load).toHaveBeenCalledTimes(3);

    clearFeatureCache();
    await getTenantFeatures('a', load, T0);
    await getTenantFeatures('b', load, T0);
    expect(load).toHaveBeenCalledTimes(5);
  });
});
