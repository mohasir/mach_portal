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
import { RESOURCES, ACTIONS, can } from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import type { ResolvedAccess } from '../../lib/rbac/access';
import type { ScopeCheck } from '../../lib/rbac/ownerScope';
import { eventOwnerId } from './events.scope';
import { eventsModule } from './events.module';

type AccessCtx = { user: { id: string }; access: ResolvedAccess };

function ownerScope(ctx: AccessCtx, gate?: ScopeCheck) {
  return eventOwnerId(ctx.access, ctx.user.id, gate);
}

export const eventsRouter = router({
  list: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.READ] })
    .input(eventsListQuerySchema)
    .query(({ input, ctx }) => eventsModule(ctx).list(input, ownerScope(ctx))),

  calendar: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.READ] })
    .input(eventsCalendarQuerySchema)
    .query(({ input, ctx }) => eventsModule(ctx).calendar(input, ownerScope(ctx))),

  getById: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.READ] })
    .input(z.object({ id: z.uuid() }))
    .query(async ({ input, ctx }) => {
      const detail = await eventsModule(ctx).getById(input.id, ownerScope(ctx));
      const canViewPayments = can(ctx.access, { [RESOURCES.PAYMENT]: [ACTIONS.READ] });
      const isOwner = ctx.access.isOwner;
      const canViewReschedules = can(ctx.access, {
        [RESOURCES.EVENT]: [ACTIONS.VIEW_RESCHEDULES],
      });
      return {
        ...detail,
        payments: canViewPayments ? detail.payments : null,
        totalPaid: canViewPayments ? detail.totalPaid : null,
        paymentStatus: canViewPayments ? detail.paymentStatus : null,
        // Activity log (staff/payments/selections/completion) is owner-only.
        history: isOwner ? detail.history : null,
        reschedules: canViewReschedules ? detail.reschedules : null,
      };
    }),

  registerPayment: guardedProcedure({ [RESOURCES.PAYMENT]: [ACTIONS.CREATE] })
    .input(z.object({ id: z.uuid(), data: registerEventPaymentSchema }))
    .mutation(({ input, ctx }) =>
      eventsModule(ctx).registerPayment(
        input.id,
        input.data,
        ctx.user.id,
        ownerScope(ctx, [RESOURCES.PAYMENT, ACTIONS.CREATE]),
      ),
    ),

  // Advisory preview: conflicts never block saving, `reschedule` recomputes them itself.
  checkReschedule: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.RESCHEDULE] })
    .input(checkRescheduleSchema)
    .query(({ input, ctx }) =>
      eventsModule(ctx).checkReschedule(
        input,
        ownerScope(ctx, [RESOURCES.EVENT, ACTIONS.RESCHEDULE]),
      ),
    ),

  reschedule: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.RESCHEDULE] })
    .input(rescheduleEventSchema)
    .mutation(({ input, ctx }) =>
      eventsModule(ctx).reschedule(
        input,
        ctx.user.id,
        { name: ctx.user.name, image: ctx.user.image ?? null },
        ownerScope(ctx, [RESOURCES.EVENT, ACTIONS.RESCHEDULE]),
      ),
    ),

  markCompleted: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.UPDATE] })
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) =>
      eventsModule(ctx).markCompleted(
        input.id,
        ctx.user.id,
        ownerScope(ctx, [RESOURCES.EVENT, ACTIONS.UPDATE]),
      ),
    ),

  assignStaff: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.MANAGE_STAFF_ASSIGNMENTS] })
    .input(assignStaffSchema)
    .mutation(({ input, ctx }) =>
      eventsModule(ctx).assignStaff(
        input,
        ctx.user.id,
        ownerScope(ctx, [RESOURCES.EVENT, ACTIONS.MANAGE_STAFF_ASSIGNMENTS]),
      ),
    ),

  removeStaff: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.MANAGE_STAFF_ASSIGNMENTS] })
    .input(removeStaffSchema)
    .mutation(({ input, ctx }) =>
      eventsModule(ctx).removeStaff(
        input,
        ctx.user.id,
        ownerScope(ctx, [RESOURCES.EVENT, ACTIONS.MANAGE_STAFF_ASSIGNMENTS]),
      ),
    ),

  removePaymentAttachment: guardedProcedure({ [RESOURCES.PAYMENT]: [ACTIONS.DELETE] })
    .input(removeEventPaymentAttachmentSchema)
    .mutation(({ input, ctx }) =>
      eventsModule(ctx).removePaymentAttachment(
        input,
        ownerScope(ctx, [RESOURCES.PAYMENT, ACTIONS.DELETE]),
      ),
    ),

  removePayment: guardedProcedure({ [RESOURCES.PAYMENT]: [ACTIONS.DELETE] })
    .input(removeEventPaymentSchema)
    .mutation(({ input, ctx }) =>
      eventsModule(ctx).removePayment(
        input.eventId,
        input.paymentId,
        ctx.user.id,
        ownerScope(ctx, [RESOURCES.PAYMENT, ACTIONS.DELETE]),
      ),
    ),

  updateSelections: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.MANAGE_SELECTIONS] })
    .input(updateEventSelectionsSchema)
    .mutation(({ input, ctx }) =>
      eventsModule(ctx).updateSelections(
        input.eventId,
        input,
        ctx.user.id,
        ownerScope(ctx, [RESOURCES.EVENT, ACTIONS.MANAGE_SELECTIONS]),
      ),
    ),
});
