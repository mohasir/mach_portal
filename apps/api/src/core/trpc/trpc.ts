import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import { hasPermission, type PermissionCheck } from '@repo/guards';
import type { Context } from './context';
import { AppError, ErrorCodes } from '../../lib/errors';

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

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if ((ctx.session.user as { mustChangePassword?: boolean }).mustChangePassword) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: new AppError(ErrorCodes.user.MUST_CHANGE_PASSWORD),
    });
  }
  return next({ ctx: { ...ctx, user: ctx.session.user, session: ctx.session } });
});

export function guardedProcedure(permissions: PermissionCheck) {
  return protectedProcedure.use(({ ctx, next }) => {
    const role = (ctx.user as { role?: string | null }).role;
    if (!hasPermission(role, permissions)) throw new TRPCError({ code: 'FORBIDDEN' });
    return next();
  });
}
