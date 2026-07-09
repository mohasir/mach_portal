import { initTRPC, TRPCError } from '@trpc/server';
import { hasPermission, type PermissionCheck } from '@repo/guards';
import type { Context } from './context';
import { AppError } from '../lib/errors';

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        errorCode: error.cause instanceof AppError ? error.cause.code : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, user: ctx.session.user, session: ctx.session } });
});

export function guardedProcedure(permissions: PermissionCheck) {
  return protectedProcedure.use(({ ctx, next }) => {
    const role = (ctx.user as { role?: string | null }).role;
    if (!hasPermission(role, permissions)) throw new TRPCError({ code: 'FORBIDDEN' });
    return next();
  });
}
