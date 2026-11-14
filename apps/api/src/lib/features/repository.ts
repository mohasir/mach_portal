import type { FeatureRow } from '@repo/guards';
import type { Executor } from '../../db';
import { tenantFeatures } from '../../db/schema';
import { tenantEq } from '../tenancy/tenantEq';

export function loadTenantFeatures(tenantId: string, executor: Executor): Promise<FeatureRow[]> {
  return executor
    .select({
      featureKey: tenantFeatures.featureKey,
      enabled: tenantFeatures.enabled,
      expiresAt: tenantFeatures.expiresAt,
    })
    .from(tenantFeatures)
    .where(tenantEq(tenantFeatures, tenantId));
}
