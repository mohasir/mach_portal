import {
  consoleOrganizationIdSchema,
  setConsoleFeatureInputSchema,
  unsetConsoleFeatureInputSchema,
} from '@repo/schemas';
import { platformProcedure, router } from '../../../core/trpc/trpc';
import { consoleModule } from '../console.module';

export const consoleFeaturesRouter = router({
  list: platformProcedure
    .input(consoleOrganizationIdSchema)
    .query(({ ctx, input }) => consoleModule(ctx).features.list(input.organizationId)),

  set: platformProcedure.input(setConsoleFeatureInputSchema).mutation(({ ctx, input }) =>
    consoleModule(ctx).features.set(input, {
      userId: ctx.platformUser.id,
      email: ctx.platformUser.email,
    }),
  ),

  unset: platformProcedure.input(unsetConsoleFeatureInputSchema).mutation(({ ctx, input }) =>
    consoleModule(ctx).features.unset(input, {
      userId: ctx.platformUser.id,
      email: ctx.platformUser.email,
    }),
  ),
});
