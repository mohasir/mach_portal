import { z } from 'zod';
import {
  createRescheduleReasonSchema,
  rescheduleReasonToggleActiveSchema,
  rescheduleReasonsListQuerySchema,
  updateRescheduleReasonSchema,
} from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { db } from '../../db';
import { RescheduleReasonsRepository } from './rescheduleReasons.repository';
import { RescheduleReasonsService } from './rescheduleReasons.service';

const service = new RescheduleReasonsService(new RescheduleReasonsRepository(db));

export const rescheduleReasonsRouter = router({
  list: guardedProcedure({ [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.READ] })
    .input(rescheduleReasonsListQuerySchema)
    .query(({ input }) => service.list(input)),

  create: guardedProcedure({ [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.CREATE] })
    .input(createRescheduleReasonSchema)
    .mutation(({ input }) => service.create(input)),

  update: guardedProcedure({ [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.UPDATE] })
    .input(z.object({ id: z.uuid(), data: updateRescheduleReasonSchema }))
    .mutation(({ input }) => service.update(input.id, input.data)),

  toggleActive: guardedProcedure({ [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.UPDATE] })
    .input(rescheduleReasonToggleActiveSchema)
    .mutation(({ input }) => service.toggleActive(input.id, input.isActive)),
});
