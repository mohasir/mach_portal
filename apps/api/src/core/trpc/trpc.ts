import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import { can, type PermissionCheck } from '@repo/guards';
import type { Context } from './context';
import { AppError, ErrorCodes } from '../../lib/errors';
import { permissionsVersion, resolveRequestAccess } from '../../lib/rbac/access';
import { HEADERS } from '../express/const/headers';
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
        errorDetails: error.cause instanceof AppError ? (error.cause.details ?? null) : null,
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
  const resolved = await resolveRequestAccess({ userId: user.id, isPlatformAdmin, tenantId });
  if (!resolved) throw new TRPCError({ code: 'FORBIDDEN' });
  const { platformAccess, access } = resolved;

  if (mustChangePassword) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: new AppError(ErrorCodes.user.MUST_CHANGE_PASSWORD),
    });
  }

  ctx.res.setHeader(HEADERS.PERMISSIONS_VERSION,permissionsVersion(access));

  if (platformAccess) {
    await recordPlatformAccess({
      userId: user.id,
      tenantId,
      sessionId: session.id,
      path,
      type: type === 'mutation' ? 'mutation' : 'query',
    });
  }

  return next({ ctx: { ...ctx, tenantId, user, session, access } });
});

export function guardedProcedure(permissions: PermissionCheck) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!can(ctx.access, permissions)) throw new TRPCError({ code: 'FORBIDDEN' });
    return next();
  });
}

// Passes when any one of the checks is fully met.
export function guardedProcedureAnyOf(...checks: [PermissionCheck, ...PermissionCheck[]]) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!checks.some((check) => can(ctx.access, check))) throw new TRPCError({ code: 'FORBIDDEN' });
    return next();
  });
}
