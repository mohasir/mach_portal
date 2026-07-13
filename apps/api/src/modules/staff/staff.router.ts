import { z } from 'zod';
import { createStaffSchema, updateStaffSchema, staffListQuerySchema } from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../trpc/trpc';
import { db } from '../../db';
import { StaffRepository } from './staff.repository';
import { StaffService } from './staff.service';

const service = new StaffService(new StaffRepository(db));

export const staffRouter = router({
  list: guardedProcedure({ [RESOURCES.STAFF]: [ACTIONS.READ] })
    .input(staffListQuerySchema)
    .query(({ input }) => service.list(input)),

  create: guardedProcedure({ [RESOURCES.STAFF]: [ACTIONS.CREATE] })
    .input(createStaffSchema)
    .mutation(({ input }) => service.create(input)),

  update: guardedProcedure({ [RESOURCES.STAFF]: [ACTIONS.UPDATE] })
    .input(z.object({ id: z.uuid(), data: updateStaffSchema }))
    .mutation(({ input }) => service.update(input.id, input.data)),

  delete: guardedProcedure({ [RESOURCES.STAFF]: [ACTIONS.DELETE] })
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input }) => service.remove(input.id)),
});
