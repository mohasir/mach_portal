import { z } from 'zod';
import {
  createEventTypeSchema,
  eventTypeToggleActiveSchema,
  eventTypesListQuerySchema,
  updateEventTypeSchema,
} from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { eventTypesModule } from './eventTypes.module';

export const eventTypesRouter = router({
  list: guardedProcedure({ [RESOURCES.EVENT_TYPE]: [ACTIONS.READ] })
    .input(eventTypesListQuerySchema)
    .query(({ ctx, input }) => eventTypesModule(ctx).list(input)),

  create: guardedProcedure({ [RESOURCES.EVENT_TYPE]: [ACTIONS.CREATE] })
    .input(createEventTypeSchema)
    .mutation(({ ctx, input }) => eventTypesModule(ctx).create(input)),

  update: guardedProcedure({ [RESOURCES.EVENT_TYPE]: [ACTIONS.UPDATE] })
    .input(z.object({ id: z.uuid(), data: updateEventTypeSchema }))
    .mutation(({ ctx, input }) => eventTypesModule(ctx).update(input.id, input.data)),

  toggleActive: guardedProcedure({ [RESOURCES.EVENT_TYPE]: [ACTIONS.UPDATE] })
    .input(eventTypeToggleActiveSchema)
    .mutation(({ ctx, input }) => eventTypesModule(ctx).toggleActive(input.id, input.isActive)),
});
