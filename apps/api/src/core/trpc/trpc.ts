import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import { hasPermission, ROLES, type PermissionCheck } from '@repo/guards';
import type { Context } from './context';
import { AppError, ErrorCodes } from '../../lib/errors';
import { evaluateTenantAccess } from '../../lib/tenancy/access';
import { recordPlatformAccess } from './platformAccess';

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    const zodError = error.cause instanceof ZodError ? error.cause : null;
    // An unexpected error's message (and stack) can carry raw SQL, bound params and ids, in dev
    // too; the full error is only logged server-side by the adapter's onError.
    const unexpected = error.code === 'INTERNAL_SERVER_ERROR' && !(error.cause instanceof AppError);
    const data = { ...shape.data };
    if (zodError || unexpected) delete data.stack;
    return {
      ...shape,
      message: zodError ? 'Invalid input' : unexpected ? 'Internal server error' : shape.message,
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

export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const tenantProcedure = authedProcedure.use(({ ctx, next }) => {
  if (!ctx.session.session.activeOrganizationId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: new AppError(ErrorCodes.tenant.NOT_SELECTED),
    });
  }
  // The active organization exists on the session but could not be loaded: it was deleted.
  if (!ctx.tenant) {
    throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.tenant.NOT_FOUND) });
  }
  return next({ ctx: { ...ctx, tenant: ctx.tenant } });
});

export const protectedProcedure = tenantProcedure.use(async ({ ctx, next, path, type }) => {
  const { session, user } = ctx.session;
  const tenantId = ctx.tenant.id;

  const { isPlatformAdmin, mustChangePassword } = user as {
    isPlatformAdmin?: boolean | null;
    mustChangePassword?: boolean | null;
  };
  const access = await evaluateTenantAccess({ userId: user.id, isPlatformAdmin, tenantId });
  if (!access.allowed) throw new TRPCError({ code: 'FORBIDDEN' });
  const { platformAccess } = access;

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
