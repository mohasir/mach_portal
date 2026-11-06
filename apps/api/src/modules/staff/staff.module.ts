import { db } from '../../db';
import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { StaffRepository } from './staff.repository';
import { StaffService } from './staff.service';

export function staffModule(ctx: TenantCtx) {
  return new StaffService(new StaffRepository(db, ctx.tenantId));
}
