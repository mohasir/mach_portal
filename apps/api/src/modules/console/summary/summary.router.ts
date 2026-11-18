import { consoleOrganizationIdSchema } from '@repo/schemas';
import { platformProcedure, router } from '../../../core/trpc/trpc';
import { consoleModule } from '../console.module';

export const consoleSummaryRouter = router({
  global: platformProcedure.query(({ ctx }) => consoleModule(ctx).summary.global()),

  organization: platformProcedure
    .input(consoleOrganizationIdSchema)
    .query(({ ctx, input }) => consoleModule(ctx).summary.organization(input.organizationId)),
});
