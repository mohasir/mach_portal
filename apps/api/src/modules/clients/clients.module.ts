import { db } from '../../db';
import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { ClientsRepository } from './clients.repository';
import { ClientsService } from './clients.service';

export function clientsModule(ctx: TenantCtx) {
  return new ClientsService(new ClientsRepository(db, ctx.tenantId));
}
