import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const select = vi.hoisted(() => vi.fn());
vi.mock('../../../db', () => ({ db: { select } }));

import { resolveTenantById, invalidateTenantCache } from '../tenantResolver';

const TENANT = { id: 'org-1', slug: 'acme', name: 'Acme' };

function dbReturns(rows: unknown[] | Error) {
  const limit = vi.fn(() => (rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows)));
  select.mockImplementation(() => ({ from: () => ({ where: () => ({ limit }) }) }));
}

describe('resolveTenantById (empty id)', () => {
  beforeEach(() => {
    select.mockClear();
    invalidateTenantCache();
  });

  it('returns null without querying the db', async () => {
    await expect(resolveTenantById('')).resolves.toBeNull();
    expect(select).not.toHaveBeenCalled();
  });
});

describe('resolveTenantById (cache)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    select.mockReset();
    invalidateTenantCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('serves a found tenant from the cache for 60 s, then reads it again', async () => {
    dbReturns([TENANT]);
    await expect(resolveTenantById('org-1')).resolves.toEqual(TENANT);
    vi.advanceTimersByTime(59_000);
    await expect(resolveTenantById('org-1')).resolves.toEqual(TENANT);
    expect(select).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2_000);
    await resolveTenantById('org-1');
    expect(select).toHaveBeenCalledTimes(2);
  });

  it('caches a miss for only 10 s', async () => {
    dbReturns([]);
    await expect(resolveTenantById('ghost')).resolves.toBeNull();
    vi.advanceTimersByTime(9_000);
    await resolveTenantById('ghost');
    expect(select).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2_000);
    await resolveTenantById('ghost');
    expect(select).toHaveBeenCalledTimes(2);
  });

  it('propagates a database error and caches nothing', async () => {
    dbReturns(new Error('db down'));
    await expect(resolveTenantById('org-1')).rejects.toThrow('db down');
    dbReturns([TENANT]);
    await expect(resolveTenantById('org-1')).resolves.toEqual(TENANT);
    expect(select).toHaveBeenCalledTimes(2);
  });

  it('invalidateTenantCache(id) forces the next read', async () => {
    dbReturns([TENANT]);
    await resolveTenantById('org-1');
    invalidateTenantCache('org-1');
    await resolveTenantById('org-1');
    expect(select).toHaveBeenCalledTimes(2);
  });
});
