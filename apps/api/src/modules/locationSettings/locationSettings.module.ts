import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { LocationSettingsRepository } from './locationSettings.repository';
import { LocationSettingsService } from './locationSettings.service';

export function locationSettingsModule(ctx: TenantCtx) {
  return new LocationSettingsService(new LocationSettingsRepository(ctx.db, ctx.tenantId));
}
