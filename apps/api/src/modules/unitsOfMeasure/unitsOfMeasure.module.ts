import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { UnitsOfMeasureRepository } from './unitsOfMeasure.repository';
import { UnitsOfMeasureService } from './unitsOfMeasure.service';

export function unitsOfMeasureModule(ctx: TenantCtx) {
  return new UnitsOfMeasureService(new UnitsOfMeasureRepository(ctx.db, ctx.tenantId));
}
