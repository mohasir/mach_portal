import { z } from 'zod';
import { createClientSchema, updateClientSchema, clientsListQuerySchema } from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { clientsModule } from './clients.module';

export const clientsRouter = router({
  list: guardedProcedure({ [RESOURCES.CLIENT]: [ACTIONS.READ] })
    .input(clientsListQuerySchema)
    .query(({ ctx, input }) => clientsModule(ctx).list(input)),

  getById: guardedProcedure({ [RESOURCES.CLIENT]: [ACTIONS.READ] })
    .input(z.object({ id: z.uuid() }))
    .query(({ ctx, input }) => clientsModule(ctx).getById(input.id)),

  create: guardedProcedure({ [RESOURCES.CLIENT]: [ACTIONS.CREATE] })
    .input(createClientSchema)
    .mutation(({ ctx, input }) => clientsModule(ctx).create(input)),

  update: guardedProcedure({ [RESOURCES.CLIENT]: [ACTIONS.UPDATE] })
    .input(z.object({ id: z.uuid(), data: updateClientSchema }))
    .mutation(({ ctx, input }) => clientsModule(ctx).update(input.id, input.data)),

  delete: guardedProcedure({ [RESOURCES.CLIENT]: [ACTIONS.DELETE] })
    .input(z.object({ id: z.uuid() }))
    .mutation(({ ctx, input }) => clientsModule(ctx).remove(input.id)),
});
