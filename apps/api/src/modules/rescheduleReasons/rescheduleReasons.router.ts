import { z } from 'zod';
import {
  createRescheduleReasonSchema,
  rescheduleReasonToggleActiveSchema,
  rescheduleReasonsListQuerySchema,
  updateRescheduleReasonSchema,
} from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { rescheduleReasonsModule } from './rescheduleReasons.module';

export const rescheduleReasonsRouter = router({
  list: guardedProcedure({ [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.READ] })
    .input(rescheduleReasonsListQuerySchema)
    .query(({ ctx, input }) => rescheduleReasonsModule(ctx).list(input)),

  create: guardedProcedure({ [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.CREATE] })
    .input(createRescheduleReasonSchema)
    .mutation(({ ctx, input }) => rescheduleReasonsModule(ctx).create(input)),

  update: guardedProcedure({ [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.UPDATE] })
    .input(z.object({ id: z.uuid(), data: updateRescheduleReasonSchema }))
    .mutation(({ ctx, input }) => rescheduleReasonsModule(ctx).update(input.id, input.data)),

  toggleActive: guardedProcedure({ [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.UPDATE] })
    .input(rescheduleReasonToggleActiveSchema)
    .mutation(({ ctx, input }) =>
      rescheduleReasonsModule(ctx).toggleActive(input.id, input.isActive),
    ),
});
