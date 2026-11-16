import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { TenantProfileRepository } from './tenant.repository';
import { TenantProfileService } from './tenant.service';

export function tenantProfileModule(ctx: TenantCtx) {
  return new TenantProfileService(new TenantProfileRepository(ctx.db, ctx.tenantId));
}
