import { updateUserPreferencesSchema } from '@repo/schemas';
import { router, protectedProcedure } from '../../core/trpc/trpc';
import { userPreferencesModule } from './userPreferences.module';

// Session only, no role permission: every procedure is scoped to the caller's own row in the
// active tenant.
export const userPreferencesRouter = router({
  get: protectedProcedure.query(({ ctx }) => userPreferencesModule(ctx).get()),
  update: protectedProcedure
    .input(updateUserPreferencesSchema)
    .mutation(({ ctx, input }) => userPreferencesModule(ctx).update(input)),
});
