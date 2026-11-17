import { z } from 'zod';
import {
  chargeTypesListQuerySchema,
  createChargeTypeSchema,
  updateChargeTypeSchema,
} from '@repo/schemas';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { requireFeature } from '../../core/trpc/requireFeature';
import { guardedProcedure, guardedProcedureAnyOf, router } from '../../core/trpc/trpc';
import { chargeTypesModule } from './chargeTypes.module';

const idInput = z.object({ id: z.uuid() });

export const chargeTypesRouter = router({
  list: guardedProcedure({ [RESOURCES.CHARGE_TYPE]: [ACTIONS.READ] })
    .input(chargeTypesListQuerySchema)
    .query(({ ctx, input }) => chargeTypesModule(ctx).list(input)),

  // The quote builder applies charges, so editing quotes is enough to list the active types.
  options: guardedProcedureAnyOf(
    { [RESOURCES.CHARGE_TYPE]: [ACTIONS.READ] },
    { [RESOURCES.QUOTE]: [ACTIONS.CREATE] },
    { [RESOURCES.QUOTE]: [ACTIONS.UPDATE] },
  ).query(({ ctx }) => chargeTypesModule(ctx).options()),

  create: guardedProcedure({ [RESOURCES.CHARGE_TYPE]: [ACTIONS.CREATE] })
    .use(requireFeature('extraCharges'))
    .input(createChargeTypeSchema)
    .mutation(({ ctx, input }) => chargeTypesModule(ctx).create(input)),

  update: guardedProcedure({ [RESOURCES.CHARGE_TYPE]: [ACTIONS.UPDATE] })
    .use(requireFeature('extraCharges'))
    .input(z.object({ id: z.uuid(), data: updateChargeTypeSchema }))
    .mutation(({ ctx, input }) => chargeTypesModule(ctx).update(input.id, input.data)),

  disable: guardedProcedure({ [RESOURCES.CHARGE_TYPE]: [ACTIONS.DISABLE] })
    .use(requireFeature('extraCharges'))
    .input(idInput)
    .mutation(({ ctx, input }) => chargeTypesModule(ctx).disable(input.id)),

  enable: guardedProcedure({ [RESOURCES.CHARGE_TYPE]: [ACTIONS.ENABLE] })
    .use(requireFeature('extraCharges'))
    .input(idInput)
    .mutation(({ ctx, input }) => chargeTypesModule(ctx).enable(input.id)),
});
