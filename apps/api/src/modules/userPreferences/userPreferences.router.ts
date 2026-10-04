import { updateUserPreferencesSchema } from '@repo/schemas';
import { router, protectedProcedure } from '../../core/trpc/trpc';
import { db } from '../../db';
import { UserPreferencesRepository } from './userPreferences.repository';
import { UserPreferencesService } from './userPreferences.service';

const service = new UserPreferencesService(new UserPreferencesRepository(db));

// Session only, no role permission: every procedure is scoped to the caller's own row.
export const userPreferencesRouter = router({
  get: protectedProcedure.query(({ ctx }) => service.get(ctx.user.id)),
  update: protectedProcedure
    .input(updateUserPreferencesSchema)
    .mutation(({ ctx, input }) => service.update(ctx.user.id, input)),
});
