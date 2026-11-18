import { setConsoleCatalogKindInputSchema } from '@repo/schemas';
import { platformProcedure, router } from '../../../core/trpc/trpc';
import { consoleModule } from '../console.module';

export const consoleCatalogRouter = router({
  setKind: platformProcedure
    .input(setConsoleCatalogKindInputSchema)
    .mutation(({ ctx, input }) =>
      consoleModule(ctx).catalog.setKind(input, { userId: ctx.platformUser.id }),
    ),
});
