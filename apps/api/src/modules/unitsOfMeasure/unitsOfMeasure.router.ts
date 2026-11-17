import { z } from 'zod';
import { createUnitSchema, unitsOfMeasureListQuerySchema, updateUnitSchema } from '@repo/schemas';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { requireFeature } from '../../core/trpc/requireFeature';
import { guardedProcedure, guardedProcedureAnyOf, router } from '../../core/trpc/trpc';
import { unitsOfMeasureModule } from './unitsOfMeasure.module';

const idInput = z.object({ id: z.uuid() });

export const unitsOfMeasureRouter = router({
  list: guardedProcedure({ [RESOURCES.UNIT_OF_MEASURE]: [ACTIONS.READ] })
    .input(unitsOfMeasureListQuerySchema)
    .query(({ ctx, input }) => unitsOfMeasureModule(ctx).list(input)),

  // The product form picks a unit, so editing products is enough to list the active ones.
  options: guardedProcedureAnyOf(
    { [RESOURCES.UNIT_OF_MEASURE]: [ACTIONS.READ] },
    { [RESOURCES.PRODUCT]: [ACTIONS.CREATE] },
    { [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] },
  ).query(({ ctx }) => unitsOfMeasureModule(ctx).options()),

  create: guardedProcedure({ [RESOURCES.UNIT_OF_MEASURE]: [ACTIONS.CREATE] })
    .use(requireFeature('unitsOfMeasure'))
    .input(createUnitSchema)
    .mutation(({ ctx, input }) => unitsOfMeasureModule(ctx).create(input)),

  update: guardedProcedure({ [RESOURCES.UNIT_OF_MEASURE]: [ACTIONS.UPDATE] })
    .use(requireFeature('unitsOfMeasure'))
    .input(z.object({ id: z.uuid(), data: updateUnitSchema }))
    .mutation(({ ctx, input }) => unitsOfMeasureModule(ctx).update(input.id, input.data)),

  disable: guardedProcedure({ [RESOURCES.UNIT_OF_MEASURE]: [ACTIONS.DISABLE] })
    .use(requireFeature('unitsOfMeasure'))
    .input(idInput)
    .mutation(({ ctx, input }) => unitsOfMeasureModule(ctx).disable(input.id)),

  enable: guardedProcedure({ [RESOURCES.UNIT_OF_MEASURE]: [ACTIONS.ENABLE] })
    .use(requireFeature('unitsOfMeasure'))
    .input(idInput)
    .mutation(({ ctx, input }) => unitsOfMeasureModule(ctx).enable(input.id)),
});
