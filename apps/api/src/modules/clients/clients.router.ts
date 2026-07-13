import { z } from 'zod';
import { createClientSchema, updateClientSchema, clientsListQuerySchema } from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../trpc/trpc';
import { db } from '../../db';
import { ClientsRepository } from './clients.repository';
import { ClientsService } from './clients.service';

const service = new ClientsService(new ClientsRepository(db));

export const clientsRouter = router({
  list: guardedProcedure({ [RESOURCES.CLIENT]: [ACTIONS.READ] })
    .input(clientsListQuerySchema)
    .query(({ input }) => service.list(input)),

  create: guardedProcedure({ [RESOURCES.CLIENT]: [ACTIONS.CREATE] })
    .input(createClientSchema)
    .mutation(({ input }) => service.create(input)),

  update: guardedProcedure({ [RESOURCES.CLIENT]: [ACTIONS.UPDATE] })
    .input(z.object({ id: z.uuid(), data: updateClientSchema }))
    .mutation(({ input }) => service.update(input.id, input.data)),

  delete: guardedProcedure({ [RESOURCES.CLIENT]: [ACTIONS.DELETE] })
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input }) => service.remove(input.id)),
});
