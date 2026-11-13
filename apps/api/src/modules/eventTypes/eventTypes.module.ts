import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { EventTypesRepository } from './eventTypes.repository';
import { EventTypesService } from './eventTypes.service';

export function eventTypesModule(ctx: TenantCtx) {
  return new EventTypesService(new EventTypesRepository(ctx.db, ctx.tenantId));
}
