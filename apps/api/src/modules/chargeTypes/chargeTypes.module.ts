import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { ChargeTypesRepository } from './chargeTypes.repository';
import { ChargeTypesService } from './chargeTypes.service';

export function chargeTypesModule(ctx: TenantCtx) {
  return new ChargeTypesService(new ChargeTypesRepository(ctx.db, ctx.tenantId));
}
