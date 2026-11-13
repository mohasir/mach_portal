import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { authDb } from '../../db';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

// User ids from `input` are resolved through the membership-scoped UsersRepository before any
// write, so a user of another tenant behaves exactly like a nonexistent one. Role rules compare
// against the actor's resolved access, never against the input.
export function usersModule(ctx: TenantCtx) {
  const { isPlatformAdmin } = ctx.user as { isPlatformAdmin?: boolean | null };
  return new UsersService(
    new UsersRepository(ctx.db, ctx.tenantId),
    { isPlatformAdmin: isPlatformAdmin === true, access: ctx.access },
    new UsersRepository(authDb, ctx.tenantId),
  );
}
