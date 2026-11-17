import { updateLocationSettingsSchema } from '@repo/schemas';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { guardedProcedure, protectedProcedure, router } from '../../core/trpc/trpc';
import { locationSettingsModule } from './locationSettings.module';

export const locationSettingsRouter = router({
  // Read by every member: the quote builder and the quote readers need it, like config.get.
  get: protectedProcedure.query(({ ctx }) => locationSettingsModule(ctx).get()),

  update: guardedProcedure({ [RESOURCES.LOCATION_SETTINGS]: [ACTIONS.UPDATE] })
    .input(updateLocationSettingsSchema)
    .mutation(({ ctx, input }) => locationSettingsModule(ctx).update(input)),
});
