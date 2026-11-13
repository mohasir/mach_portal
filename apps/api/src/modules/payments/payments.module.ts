import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';

export function paymentsModule(ctx: TenantCtx) {
  return new PaymentsService(new PaymentsRepository(ctx.db, ctx.tenantId));
}
