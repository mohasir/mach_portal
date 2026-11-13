import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { UserPreferencesRepository } from './userPreferences.repository';
import { UserPreferencesService } from './userPreferences.service';

export function userPreferencesModule(ctx: TenantCtx) {
  return new UserPreferencesService(
    new UserPreferencesRepository(ctx.db, ctx.tenantId),
    ctx.user.id,
  );
}
