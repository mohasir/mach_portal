import { db } from '../../db';
import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

export function dashboardModule(ctx: TenantCtx) {
  return new DashboardService(new DashboardRepository(db, ctx.tenantId));
}
