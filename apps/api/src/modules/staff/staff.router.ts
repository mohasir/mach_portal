import { z } from 'zod';
import {
  createStaffSchema,
  updateStaffSchema,
  staffAvailabilityQuerySchema,
  staffListQuerySchema,
} from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../core/trpc/trpc';
import { staffModule } from './staff.module';

export const staffRouter = router({
  list: guardedProcedure({ [RESOURCES.STAFF]: [ACTIONS.READ] })
    .input(staffListQuerySchema)
    .query(({ ctx, input }) => staffModule(ctx).list(input)),

  getAvailability: guardedProcedure({ [RESOURCES.STAFF]: [ACTIONS.READ] })
    .input(staffAvailabilityQuerySchema)
    .query(({ ctx, input }) => staffModule(ctx).getAvailability(input.date)),

  create: guardedProcedure({ [RESOURCES.STAFF]: [ACTIONS.CREATE] })
    .input(createStaffSchema)
    .mutation(({ ctx, input }) => staffModule(ctx).create(input)),

  update: guardedProcedure({ [RESOURCES.STAFF]: [ACTIONS.UPDATE] })
    .input(z.object({ id: z.uuid(), data: updateStaffSchema }))
    .mutation(({ ctx, input }) => staffModule(ctx).update(input.id, input.data)),

  delete: guardedProcedure({ [RESOURCES.STAFF]: [ACTIONS.DELETE] })
    .input(z.object({ id: z.uuid() }))
    .mutation(({ ctx, input }) => staffModule(ctx).remove(input.id)),
});
