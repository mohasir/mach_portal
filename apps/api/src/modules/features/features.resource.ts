import { FEATURE_KEYS, FEATURES, type FeatureKey, type FeatureRow } from '@repo/guards';
import type { MyFeatures } from '@repo/schemas';

// Core features have no row and never expire; the rest report the expiry stored for the tenant.
export function myFeaturesResource(
  active: ReadonlySet<FeatureKey>,
  rows: readonly FeatureRow[],
): MyFeatures {
  const expiry = new Map(rows.map((r) => [r.featureKey, r.expiresAt]));
  return {
    features: FEATURE_KEYS.filter((key) => active.has(key)).map((key) => ({
      key,
      expiresAt: FEATURES[key].kind === 'core' ? null : (expiry.get(key)?.toISOString() ?? null),
    })),
  };
}
