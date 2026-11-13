import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { ConfigRepository } from './config.repository';
import { ConfigService } from './config.service';

export function configModule(ctx: TenantCtx) {
  return new ConfigService(new ConfigRepository(ctx.db, ctx.tenantId));
}
