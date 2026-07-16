import { z } from 'zod';
import {
  assignStaffSchema,
  eventsCalendarQuerySchema,
  eventsListQuerySchema,
  removeStaffSchema,
  updateEventPaymentSchema,
} from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../trpc/trpc';
import { db } from '../../db';
import { EventsRepository } from './events.repository';
import { EventsService } from './events.service';

const service = new EventsService(new EventsRepository(db));

export const eventsRouter = router({
  list: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.READ] })
    .input(eventsListQuerySchema)
    .query(({ input }) => service.list(input)),

  calendar: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.READ] })
    .input(eventsCalendarQuerySchema)
    .query(({ input }) => service.calendar(input)),

  getById: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.READ] })
    .input(z.object({ id: z.uuid() }))
    .query(({ input }) => service.getById(input.id)),

  updatePayment: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.UPDATE] })
    .input(z.object({ id: z.uuid(), data: updateEventPaymentSchema }))
    .mutation(({ input }) => service.updatePayment(input.id, input.data)),

  markCompleted: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.UPDATE] })
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input }) => service.markCompleted(input.id)),

  assignStaff: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.UPDATE] })
    .input(assignStaffSchema)
    .mutation(({ input }) => service.assignStaff(input)),

  removeStaff: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.UPDATE] })
    .input(removeStaffSchema)
    .mutation(({ input }) => service.removeStaff(input)),
});
