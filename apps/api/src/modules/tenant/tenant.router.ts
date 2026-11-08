import { z } from 'zod';
import { authedProcedure, protectedProcedure, router } from '../../core/trpc/trpc';
import { db } from '../../db';
import { TenantRepository } from './tenant.repository';
import { TenantService } from './tenant.service';

const service = new TenantService(new TenantRepository(db));

type SessionUser = { id: string; isPlatformAdmin?: boolean | null };

export const tenantRouter = router({
  active: authedProcedure.query(({ ctx }) =>
    service.active(ctx.session.user as SessionUser, ctx.tenant),
  ),

  permissions: protectedProcedure.query(({ ctx }) => service.permissions(ctx.access)),

  permissionsVersion: protectedProcedure.query(({ ctx }) => service.permissionsVersion(ctx.access)),

  memberships: authedProcedure.query(({ ctx }) => service.memberships(ctx.session.user.id)),

  listAll: authedProcedure.query(({ ctx }) => service.listAll(ctx.session.user as SessionUser)),

  select: authedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .mutation(({ ctx, input, path }) =>
      service.select(
        ctx.session.user as SessionUser,
        ctx.session.session.id,
        input.organizationId,
        path,
      ),
    ),
});
