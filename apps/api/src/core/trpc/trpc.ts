import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import { hasPermission, ROLES, type PermissionCheck } from '@repo/guards';
import type { Context } from './context';
import { AppError, ErrorCodes } from '../../lib/errors';
import { isMemberOf } from '../../lib/tenant/membership';
import { recordPlatformAccess } from './platformAccess';

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    const zodError = error.cause instanceof ZodError ? error.cause : null;
    const data = { ...shape.data };
    if (zodError) delete data.stack;
    return {
      ...shape,
      message: zodError ? 'Invalid input' : shape.message,
      data: {
        ...data,
        errorCode: error.cause instanceof AppError ? error.cause.code : null,
        fieldErrors: zodError
          ? zodError.issues.map((issue) => ({ path: issue.path, message: issue.message }))
          : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const tenantProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.tenant) {
    throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.tenant.NOT_FOUND) });
  }
  return next({ ctx: { ...ctx, tenant: ctx.tenant } });
});

export const protectedProcedure = tenantProcedure.use(async ({ ctx, next, path, type }) => {
  if (!ctx.session) throw new TRPCError({ code: 'UNAUTHORIZED' });
  const { session, user } = ctx.session;
  const tenantId = ctx.tenant.id;
  // The session must have been scoped to this very tenant (host), so a cookie shared across
  // subdomains cannot be replayed against another tenant.
  if (session.activeOrganizationId !== tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });

  const { isPlatformAdmin, mustChangePassword } = user as {
    isPlatformAdmin?: boolean | null;
    mustChangePassword?: boolean | null;
  };
  const member = await isMemberOf(user.id, tenantId);
  const platformAccess = !member && Boolean(isPlatformAdmin);
  if (!member && !platformAccess) throw new TRPCError({ code: 'FORBIDDEN' });

  if (mustChangePassword) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: new AppError(ErrorCodes.user.MUST_CHANGE_PASSWORD),
    });
  }

  if (platformAccess) {
    await recordPlatformAccess({
      userId: user.id,
      tenantId,
      sessionId: session.id,
      path,
      type: type === 'mutation' ? 'mutation' : 'query',
    });
  }

  // A platform admin without membership has no role in the tenant, so it acts as superadmin.
  const effectiveUser = platformAccess ? { ...user, role: ROLES.SUPERADMIN } : user;
  return next({ ctx: { ...ctx, tenantId, user: effectiveUser, session } });
});

export function guardedProcedure(permissions: PermissionCheck) {
  return protectedProcedure.use(({ ctx, next }) => {
    const role = (ctx.user as { role?: string | null }).role;
    if (!hasPermission(role, permissions)) throw new TRPCError({ code: 'FORBIDDEN' });
    return next();
  });
}
