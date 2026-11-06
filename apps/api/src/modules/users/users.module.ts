import { db } from '../../db';
import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

// User ids from `input` are resolved through the membership-scoped UsersRepository before any
// write, so a user of another tenant behaves exactly like a nonexistent one.
export function usersModule(ctx: TenantCtx) {
  const { isPlatformAdmin } = ctx.user as { isPlatformAdmin?: boolean | null };
  return new UsersService(new UsersRepository(db, ctx.tenantId), {
    isPlatformAdmin: isPlatformAdmin === true,
  });
}
