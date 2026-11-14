import { resolveFeatures, type FeatureKey, type FeatureRow } from '@repo/guards';

// The feature scripts run in another process and cannot invalidate this cache, so a change
// takes at most this long to reach the API.
export const FEATURE_CACHE_TTL_MS = 30_000;

type Entry = { rows: readonly FeatureRow[]; loadedAt: number };

const cache = new Map<string, Entry>();

// Rows are cached rather than the resolved set, so an expiry that falls inside the TTL applies on
// time. A failed load resolves to the core features only (fail closed) and is not cached, so the
// next request retries.
export async function getTenantFeatures(
  tenantId: string,
  load: () => Promise<FeatureRow[]>,
  now: Date = new Date(),
): Promise<ReadonlySet<FeatureKey>> {
  const hit = cache.get(tenantId);
  if (hit && now.getTime() - hit.loadedAt < FEATURE_CACHE_TTL_MS) {
    return resolveFeatures(hit.rows, now);
  }
  let rows: FeatureRow[];
  try {
    rows = await load();
  } catch (err) {
    console.error(`[features] could not load the features of organization ${tenantId}`, err);
    return resolveFeatures([], now);
  }
  cache.set(tenantId, { rows, loadedAt: now.getTime() });
  return resolveFeatures(rows, now);
}

export function clearFeatureCache(tenantId?: string): void {
  if (tenantId === undefined) cache.clear();
  else cache.delete(tenantId);
}
