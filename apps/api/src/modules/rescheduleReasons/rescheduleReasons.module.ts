import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { RescheduleReasonsRepository } from './rescheduleReasons.repository';
import { RescheduleReasonsService } from './rescheduleReasons.service';

export function rescheduleReasonsModule(ctx: TenantCtx) {
  return new RescheduleReasonsService(new RescheduleReasonsRepository(ctx.db, ctx.tenantId));
}
