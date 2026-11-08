import { db } from '../../db';
import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { RolesRepository } from './roles.repository';
import { RolesService } from './roles.service';

// The escalation rules compare against the actor's resolved access, never against the input.
export function rolesModule(ctx: TenantCtx) {
  return new RolesService(new RolesRepository(db, ctx.tenantId), {
    userId: ctx.user.id,
    access: ctx.access,
  });
}
