import { db } from '../../db';
import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { RescheduleReasonsRepository } from './rescheduleReasons.repository';
import { RescheduleReasonsService } from './rescheduleReasons.service';

export function rescheduleReasonsModule(ctx: TenantCtx) {
  return new RescheduleReasonsService(new RescheduleReasonsRepository(db, ctx.tenantId));
}
