import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createUserSchema, updateUserSchema, usersListQuerySchema } from '@repo/schemas';
import { router, guardedProcedure } from '../../trpc/trpc';
import { db } from '../../db';
import { AppError, ErrorCodes } from '../../lib/errors';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const service = new UsersService(new UsersRepository(db));

const currentRole = (ctx: { user: { role?: string | null } }) => ctx.user.role ?? null;

export const usersRouter = router({
  list: guardedProcedure({ user: ['list'] })
    .input(usersListQuerySchema)
    .query(({ input }) => service.list(input)),

  create: guardedProcedure({ user: ['create'] })
    .input(createUserSchema)
    .mutation(({ input }) => service.create(input)),

  update: guardedProcedure({ user: ['update'] })
    .input(z.object({ id: z.string(), data: updateUserSchema }))
    .mutation(({ ctx, input }) => {
      // A superadmin must not change their own role and lock themselves out.
      if (input.id === ctx.user.id && input.data.role !== currentRole(ctx)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          cause: new AppError(ErrorCodes.user.CANNOT_EDIT_OWN_ROLE),
        });
      }
      return service.update(input.id, input.data);
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
      return service.remove(input.id);
    }),
});
