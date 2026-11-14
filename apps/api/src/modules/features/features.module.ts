import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { loadTenantFeatures } from '../../lib/features/repository';
import { FeaturesService } from './features.service';

export function featuresModule(ctx: TenantCtx) {
  return new FeaturesService(() => loadTenantFeatures(ctx.tenantId, ctx.db));
}
