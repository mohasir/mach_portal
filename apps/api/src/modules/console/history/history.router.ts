import { consoleHistoryQuerySchema } from '@repo/schemas';
import { platformProcedure, router } from '../../../core/trpc/trpc';
import { consoleModule } from '../console.module';

export const consoleHistoryRouter = router({
  list: platformProcedure
    .input(consoleHistoryQuerySchema)
    .query(({ ctx, input }) => consoleModule(ctx).history.list(input)),
});
