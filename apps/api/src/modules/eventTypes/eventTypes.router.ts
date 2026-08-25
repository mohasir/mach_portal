import { z } from 'zod';
import {
  createEventTypeSchema,
  eventTypeToggleActiveSchema,
  eventTypesListQuerySchema,
  updateEventTypeSchema,
} from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { db } from '../../db';
import { EventTypesRepository } from './eventTypes.repository';
import { EventTypesService } from './eventTypes.service';

const service = new EventTypesService(new EventTypesRepository(db));

export const eventTypesRouter = router({
  list: guardedProcedure({ [RESOURCES.EVENT_TYPE]: [ACTIONS.READ] })
    .input(eventTypesListQuerySchema)
    .query(({ input }) => service.list(input)),

  create: guardedProcedure({ [RESOURCES.EVENT_TYPE]: [ACTIONS.CREATE] })
    .input(createEventTypeSchema)
    .mutation(({ input }) => service.create(input)),

  update: guardedProcedure({ [RESOURCES.EVENT_TYPE]: [ACTIONS.UPDATE] })
    .input(z.object({ id: z.uuid(), data: updateEventTypeSchema }))
    .mutation(({ input }) => service.update(input.id, input.data)),

  toggleActive: guardedProcedure({ [RESOURCES.EVENT_TYPE]: [ACTIONS.UPDATE] })
    .input(eventTypeToggleActiveSchema)
    .mutation(({ input }) => service.toggleActive(input.id, input.isActive)),
});
