import { FEATURES, FEATURE_KEYS, isFeatureKey, type FeatureKey } from './registry';

export type FeatureRow = {
  featureKey: string;
  enabled: boolean;
  expiresAt: Date | null;
};

export function resolveFeatures(
  rows: readonly FeatureRow[],
  now: Date,
): ReadonlySet<FeatureKey> {
  const live = new Set<FeatureKey>();
  for (const r of rows) {
    if (!isFeatureKey(r.featureKey) || !r.enabled) continue;
    if (r.expiresAt !== null && r.expiresAt.getTime() <= now.getTime()) continue;
    live.add(r.featureKey);
  }

  const active = new Set<FeatureKey>(
    FEATURE_KEYS.filter((k) => FEATURES[k].kind === 'core'),
  );
  // Fixed point: activating a feature can unlock features that require it.
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of live) {
      if (active.has(key)) continue;
      if (FEATURES[key].requires.every((dep) => active.has(dep))) {
        active.add(key);
        changed = true;
      }
    }
  }
  return active;
}
