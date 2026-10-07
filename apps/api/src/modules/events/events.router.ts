import { z } from 'zod';
import {
  assignStaffSchema,
  checkRescheduleSchema,
  eventsCalendarQuerySchema,
  eventsListQuerySchema,
  registerEventPaymentSchema,
  removeEventPaymentAttachmentSchema,
  removeEventPaymentSchema,
  removeStaffSchema,
  rescheduleEventSchema,
  updateEventSelectionsSchema,
} from '@repo/schemas';
import {
  RESOURCES,
  ACTIONS,
  DEFAULT_ROLE,
  SUPERADMIN_ROLE,
  hasPermission,
  resolveResourceScope,
} from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { db } from '../../db';
import { ConfigRepository } from '../config/config.repository';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { QuotesRepository } from '../quotes/quotes.repository';
import { RescheduleReasonsRepository } from '../rescheduleReasons/rescheduleReasons.repository';
import { EventsRepository } from './events.repository';
import { EventsService } from './events.service';

const service = new EventsService(
  new EventsRepository(db),
  new QuotesRepository(db),
  new ConfigRepository(db),
  new RescheduleReasonsRepository(db),
  new NotificationsRepository(db),
);

// scope 'own' (resolveResourceScope) → solo ve/gestiona eventos cuya cotización creó o
// tiene asignada (events.repository.ts ownerFilter/belongsToOwner); scope 'all' → todos.
// Siempre se resuelve contra RESOURCES.EVENT, sea cual sea el permiso que gatea el
// procedure puntual (PAYMENT, MANAGE_SELECTIONS...) — lo que se está filtrando es el evento.
function ownerScope(ctx: { user: { id: string; role?: string | null } }) {
  return resolveResourceScope(ctx.user.role, RESOURCES.EVENT) === 'own' ? ctx.user.id : undefined;
}

export const eventsRouter = router({
  list: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.READ] })
    .input(eventsListQuerySchema)
    .query(({ input, ctx }) => service.list(input, ownerScope(ctx))),

  calendar: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.READ] })
    .input(eventsCalendarQuerySchema)
    .query(({ input, ctx }) => service.calendar(input, ownerScope(ctx))),

  getById: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.READ] })
    .input(z.object({ id: z.uuid() }))
    .query(async ({ input, ctx }) => {
      const detail = await service.getById(input.id, ownerScope(ctx));
      const role = (ctx.user as { role?: string | null }).role;
      const canViewPayments = hasPermission(role, { [RESOURCES.PAYMENT]: [ACTIONS.READ] });
      const isSuperAdmin = (role ?? DEFAULT_ROLE).split(',').includes(SUPERADMIN_ROLE);
      const canViewReschedules = hasPermission(role, {
        [RESOURCES.EVENT]: [ACTIONS.VIEW_RESCHEDULES],
      });
      return {
        ...detail,
        payments: canViewPayments ? detail.payments : null,
        totalPaid: canViewPayments ? detail.totalPaid : null,
        paymentStatus: canViewPayments ? detail.paymentStatus : null,
        // Activity log (staff/payments/selections/completion) is superadmin-only.
        history: isSuperAdmin ? detail.history : null,
        reschedules: canViewReschedules ? detail.reschedules : null,
      };
    }),

  registerPayment: guardedProcedure({ [RESOURCES.PAYMENT]: [ACTIONS.CREATE] })
    .input(z.object({ id: z.uuid(), data: registerEventPaymentSchema }))
    .mutation(({ input, ctx }) =>
      service.registerPayment(input.id, input.data, ctx.user.id, ownerScope(ctx)),
    ),

  // Advisory preview: conflicts never block saving, `reschedule` recomputes them itself.
  checkReschedule: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.RESCHEDULE] })
    .input(checkRescheduleSchema)
    .query(({ input, ctx }) => service.checkReschedule(input, ownerScope(ctx))),

  reschedule: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.RESCHEDULE] })
    .input(rescheduleEventSchema)
    .mutation(({ input, ctx }) =>
      service.reschedule(
        input,
        ctx.user.id,
        { name: ctx.user.name, image: ctx.user.image ?? null },
        ownerScope(ctx),
      ),
    ),

  markCompleted: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.UPDATE] })
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) => service.markCompleted(input.id, ctx.user.id, ownerScope(ctx))),

  assignStaff: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.MANAGE_STAFF_ASSIGNMENTS] })
    .input(assignStaffSchema)
    .mutation(({ input, ctx }) => service.assignStaff(input, ctx.user.id, ownerScope(ctx))),

  removeStaff: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.MANAGE_STAFF_ASSIGNMENTS] })
    .input(removeStaffSchema)
    .mutation(({ input, ctx }) => service.removeStaff(input, ctx.user.id, ownerScope(ctx))),

  removePaymentAttachment: guardedProcedure({ [RESOURCES.PAYMENT]: [ACTIONS.DELETE] })
    .input(removeEventPaymentAttachmentSchema)
    .mutation(({ input, ctx }) => service.removePaymentAttachment(input, ownerScope(ctx))),

  removePayment: guardedProcedure({ [RESOURCES.PAYMENT]: [ACTIONS.DELETE] })
    .input(removeEventPaymentSchema)
    .mutation(({ input, ctx }) =>
      service.removePayment(input.eventId, input.paymentId, ctx.user.id, ownerScope(ctx)),
    ),

  updateSelections: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.MANAGE_SELECTIONS] })
    .input(updateEventSelectionsSchema)
    .mutation(({ input, ctx }) =>
      service.updateSelections(input.eventId, input, ctx.user.id, ownerScope(ctx)),
    ),
});
