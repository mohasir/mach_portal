import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createUserSchema, updateUserSchema, usersListQuerySchema } from '@repo/schemas';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { AppError, ErrorCodes } from '../../lib/errors';
import { usersModule } from './users.module';

export const usersRouter = router({
  list: guardedProcedure({ user: ['list'] })
    .input(usersListQuerySchema)
    .query(({ ctx, input }) => usersModule(ctx).list(input)),

  create: guardedProcedure({ user: ['create'] })
    .input(createUserSchema)
    .mutation(({ ctx, input }) => usersModule(ctx).create(input)),

  update: guardedProcedure({ user: ['update'] })
    .input(z.object({ id: z.string(), data: updateUserSchema }))
    .mutation(({ ctx, input }) => {
      // Nobody changes their own role: it would let them lock themselves out.
      if (input.id === ctx.user.id && input.data.roleId !== ctx.access.roleId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          cause: new AppError(ErrorCodes.user.CANNOT_EDIT_OWN_ROLE),
        });
      }
      return usersModule(ctx).update(input.id, input.data);
    }),

  delete: guardedProcedure({ user: ['delete'] })
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          cause: new AppError(ErrorCodes.user.CANNOT_DELETE_SELF),
        });
      }
      return usersModule(ctx).remove(input.id);
    }),

  generatePasswordSetupLink: guardedProcedure({ user: ['set-password'] })
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => usersModule(ctx).regeneratePasswordSetupLink(input.id)),
});
