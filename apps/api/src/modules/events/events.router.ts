import { z } from 'zod';
import {
  assignStaffSchema,
  eventsCalendarQuerySchema,
  eventsListQuerySchema,
  registerEventPaymentSchema,
  removeEventPaymentAttachmentSchema,
  removeStaffSchema,
} from '@repo/schemas';
import { RESOURCES, ACTIONS, hasPermission } from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
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
    .query(async ({ input, ctx }) => {
      const detail = await service.getById(input.id);
      const role = (ctx.user as { role?: string | null }).role;
      const canViewPayments = hasPermission(role, { [RESOURCES.PAYMENT]: [ACTIONS.READ] });
      return {
        ...detail,
        payments: canViewPayments ? detail.payments : null,
        totalPaid: canViewPayments ? detail.totalPaid : null,
        paymentStatus: canViewPayments ? detail.paymentStatus : null,
      };
    }),

  registerPayment: guardedProcedure({ [RESOURCES.PAYMENT]: [ACTIONS.CREATE] })
    .input(z.object({ id: z.uuid(), data: registerEventPaymentSchema }))
    .mutation(({ input, ctx }) => service.registerPayment(input.id, input.data, ctx.user.id)),

  markCompleted: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.UPDATE] })
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input }) => service.markCompleted(input.id)),

  assignStaff: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.UPDATE] })
    .input(assignStaffSchema)
    .mutation(({ input }) => service.assignStaff(input)),

  removeStaff: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.UPDATE] })
    .input(removeStaffSchema)
    .mutation(({ input }) => service.removeStaff(input)),

  removePaymentAttachment: guardedProcedure({ [RESOURCES.PAYMENT]: [ACTIONS.DELETE] })
    .input(removeEventPaymentAttachmentSchema)
    .mutation(({ input }) => service.removePaymentAttachment(input)),
});
