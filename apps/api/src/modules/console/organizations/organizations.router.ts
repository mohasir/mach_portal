import {
  consoleOrganizationIdSchema,
  consoleOrganizationListQuerySchema,
  createOrganizationInputSchema,
} from '@repo/schemas';
import { platformProcedure, router } from '../../../core/trpc/trpc';
import { consoleModule } from '../console.module';

export const organizationsRouter = router({
  list: platformProcedure
    .input(consoleOrganizationListQuerySchema)
    .query(({ ctx, input }) => consoleModule(ctx).organizations.list(input)),

  get: platformProcedure.input(consoleOrganizationIdSchema).query(({ ctx, input }) =>
    consoleModule(ctx).organizations.get(input.organizationId, {
      userId: ctx.platformUser.id,
      sessionId: ctx.session.session.id,
    }),
  ),

  create: platformProcedure
    .input(createOrganizationInputSchema)
    .mutation(({ ctx, input }) =>
      consoleModule(ctx).organizations.create(input, { userId: ctx.platformUser.id }),
    ),
});
